import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure, sellerProcedure } from '../trpc'
import { createReviewInput, replyReviewInput } from '@/lib/validators/review'
import { decodeCursor, paginateResults } from '@/lib/utils/pagination'

export const reviewRouter = router({
  create: protectedProcedure
    .input(createReviewInput)
    .mutation(async ({ ctx, input }) => {
      // Check if seller exists and not suspended
      const { data: seller } = await ctx.db
        .from('sellers')
        .select('id, is_suspended')
        .eq('id', input.seller_id)
        .single()

      if (!seller || seller.is_suspended) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '賣家不存在' })
      }

      // Check unique constraint (one review per buyer per seller)
      const { data: existing } = await ctx.db
        .from('reviews')
        .select('id')
        .eq('seller_id', input.seller_id)
        .eq('reviewer_id', ctx.user.id)
        .single()

      if (existing) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '您已經對此賣家留過評價' })
      }

      const { data, error } = await ctx.db
        .from('reviews')
        .insert({
          seller_id: input.seller_id,
          reviewer_id: ctx.user.id,
          rating: input.rating,
          comment: input.comment ?? null,
          status: 'visible',
        })
        .select()
        .single()

      if (error) throw error

      // Notify seller
      await ctx.db.from('notifications').insert({
        recipient_id: input.seller_id,
        type: 'review_received',
        payload: { review_id: data.id, reviewer_id: ctx.user.id, rating: input.rating },
      })

      return data
    }),

  reply: sellerProcedure
    .input(replyReviewInput)
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.db
        .from('reviews')
        .update({
          seller_reply: input.seller_reply,
          seller_replied_at: new Date().toISOString(),
        })
        .eq('id', input.review_id)
        .eq('seller_id', ctx.seller.id)
        .select()
        .single()

      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '評價不存在' })
      }

      return data
    }),

  like: protectedProcedure
    .input(z.object({ review_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check if already liked
      const { data: existing } = await ctx.db
        .from('review_likes')
        .select('id')
        .eq('review_id', input.review_id)
        .eq('user_id', ctx.user.id)
        .single()

      if (existing) {
        // Unlike
        await ctx.db.from('review_likes').delete().eq('id', existing.id)
        return { liked: false }
      }

      // Like
      await ctx.db.from('review_likes').insert({
        review_id: input.review_id,
        user_id: ctx.user.id,
      })

      // Notify review author
      const { data: review } = await ctx.db
        .from('reviews')
        .select('reviewer_id')
        .eq('id', input.review_id)
        .single()

      if (review && review.reviewer_id !== ctx.user.id) {
        await ctx.db.from('notifications').insert({
          recipient_id: review.reviewer_id,
          type: 'review_liked',
          payload: { review_id: input.review_id, liker_id: ctx.user.id },
        })
      }

      return { liked: true }
    }),

  getBySeller: publicProcedure
    .input(z.object({
      seller_id: z.string().uuid(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('reviews')
        .select(`
          *,
          reviewer:profiles!reviewer_id(id, display_name, avatar_url)
        `)
        .eq('seller_id', input.seller_id)
        .eq('status', 'visible')
        .order('created_at', { ascending: false })

      if (input.cursor) {
        const { id } = decodeCursor(input.cursor)
        query = query.lt('id', id)
      }

      query = query.limit(input.limit + 1)

      const { data, error } = await query
      if (error) throw error

      // Check likes for current user
      let likedReviewIds: Set<string> = new Set()
      if (ctx.user && data) {
        const reviewIds = data.map((r: any) => r.id)
        const { data: likes } = await ctx.db
          .from('review_likes')
          .select('review_id')
          .eq('user_id', ctx.user.id)
          .in('review_id', reviewIds)

        likedReviewIds = new Set(likes?.map((l: any) => l.review_id) ?? [])
      }

      const enriched = (data ?? []).map((r: any) => ({
        ...r,
        hasLiked: likedReviewIds.has(r.id),
      }))

      return paginateResults(enriched, input.limit)
    }),

  // My reviews (for profile page)
  myReviews: protectedProcedure
    .input(z.object({
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('reviews')
        .select(`
          *,
          seller:sellers(id, name)
        `)
        .eq('reviewer_id', ctx.user.id)
        .order('created_at', { ascending: false })

      if (input.cursor) {
        const { id } = decodeCursor(input.cursor)
        query = query.lt('id', id)
      }

      query = query.limit(input.limit + 1)

      const { data, error } = await query
      if (error) throw error
      return paginateResults(data ?? [], input.limit)
    }),
})
