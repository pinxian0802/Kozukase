import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { decodeCursor, paginateResults } from '@/lib/utils/pagination'

export const followRouter = router({
  toggle: protectedProcedure
    .input(z.object({ seller_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.id === input.seller_id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '無法追蹤自己' })
      }

      const { data: existing } = await ctx.db
        .from('follows')
        .select('id')
        .eq('follower_id', ctx.user.id)
        .eq('seller_id', input.seller_id)
        .single()

      if (existing) {
        await ctx.db.from('follows').delete().eq('id', existing.id)
        return { following: false }
      }

      await ctx.db.from('follows').insert({
        follower_id: ctx.user.id,
        seller_id: input.seller_id,
      })
      return { following: true }
    }),

  myFollows: protectedProcedure
    .input(z.object({
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('follows')
        .select(`
          id, created_at,
          seller:sellers(
            id, name, avg_rating, review_count, is_social_verified,
            ig_handle, threads_handle, avatar_url,
            profile:profiles(display_name, avatar_url)
          )
        `)
        .eq('follower_id', ctx.user.id)
        .order('created_at', { ascending: false })

      if (input.cursor) {
        const { sortValue } = decodeCursor(input.cursor)
        if (sortValue) query = query.lt('created_at', sortValue)
      }

      query = query.limit(input.limit + 1)
      const { data, error } = await query
      if (error) throw error
      return paginateResults(data ?? [], input.limit, (item) => item.created_at)
    }),
})
