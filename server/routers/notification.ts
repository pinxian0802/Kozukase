import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { decodeCursor, paginateResults } from '@/lib/utils/pagination'

export const notificationRouter = router({
  list: protectedProcedure
    .input(z.object({
      unreadOnly: z.boolean().default(false),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('notifications')
        .select('*')
        .eq('recipient_id', ctx.user.id)
        .order('created_at', { ascending: false })

      if (input.unreadOnly) {
        query = query.eq('is_read', false)
      }

      if (input.cursor) {
        const { id } = decodeCursor(input.cursor)
        query = query.lt('id', id)
      }

      query = query.limit(input.limit + 1)

      const { data, error } = await query
      if (error) throw error
      return paginateResults(data ?? [], input.limit)
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const { count, error } = await ctx.db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', ctx.user.id)
      .eq('is_read', false)

    if (error) throw error
    return { count: count ?? 0 }
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .from('notifications')
        .update({ is_read: true })
        .eq('id', input.id)
        .eq('recipient_id', ctx.user.id)

      return { success: true }
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', ctx.user.id)
      .eq('is_read', false)

    return { success: true }
  }),
})
