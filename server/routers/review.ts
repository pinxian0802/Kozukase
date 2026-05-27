import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure, sellerProcedure } from '../trpc'
import { createReviewInput, updateReviewInput, replyReviewInput } from '@/lib/validators/review'
import { decodeCursor, paginateResults } from '@/lib/utils/pagination'

export const reviewRouter = router({
  create: protectedProcedure
    .input(createReviewInput)
    .mutation(async ({ ctx, input }) => {
      // 不能評價自己
      if (input.seller_id === ctx.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '無法評價自己' })
      }

      // Check if seller exists and not suspended
      const { data: seller } = await ctx.db
        .from('sellers')
        .select('id, is_suspended')
        .eq('id', input.seller_id)
        .maybeSingle()

      if (!seller || seller.is_suspended) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '賣家不存在' })
      }

      // Check unique constraint (one review per buyer per seller)
      const { data: existing } = await ctx.db
        .from('reviews')
        .select('id')
        .eq('seller_id', input.seller_id)
        .eq('reviewer_id', ctx.user.id)
        .maybeSingle()

      if (existing) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '您已經對此賣家留過評價' })
      }

      // 防刷評：每位使用者每日最多新增 DAILY_REVIEW_LIMIT 則評價
      const DAILY_REVIEW_LIMIT = 5
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { count: recentCount } = await ctx.db
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('reviewer_id', ctx.user.id)
        .gte('created_at', since)

      if ((recentCount ?? 0) >= DAILY_REVIEW_LIMIT) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: '今日評價次數已達上限，請明天再試',
        })
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

      if (error) {
        // 兩個請求同時通過上面的重複檢查時，靠資料庫唯一鍵擋下，回友善訊息
        if ((error as { code?: string }).code === '23505') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '您已經對此賣家留過評價' })
        }
        throw error
      }

      // Notify seller
      await ctx.db.from('notifications').insert({
        recipient_id: input.seller_id,
        type: 'review_received',
        payload: { review_id: data.id, reviewer_id: ctx.user.id, rating: input.rating },
      })

      return data
    }),

  // 編輯自己留的評價
  update: protectedProcedure
    .input(updateReviewInput)
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.db
        .from('reviews')
        .update({
          rating: input.rating,
          comment: input.comment ?? null,
        })
        .eq('id', input.review_id)
        .eq('reviewer_id', ctx.user.id)
        .select()
        .single()

      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '評價不存在' })
      }

      return data
    }),

  // 刪除自己留的評價
  remove: protectedProcedure
    .input(z.object({ review_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.db
        .from('reviews')
        .delete()
        .eq('id', input.review_id)
        .eq('reviewer_id', ctx.user.id)

      if (error) throw error
      return { success: true }
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

      // 通知留評價的買家：賣家已回覆
      if (data.reviewer_id !== ctx.seller.id) {
        await ctx.db.from('notifications').insert({
          recipient_id: data.reviewer_id,
          type: 'review_replied',
          payload: { review_id: data.id, seller_id: ctx.seller.id },
        })
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
        .maybeSingle()

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

      // 通知評價作者：評價被按讚（不通知自己按自己）
      const { data: review } = await ctx.db
        .from('reviews')
        .select('id, reviewer_id')
        .eq('id', input.review_id)
        .maybeSingle()

      if (review && review.reviewer_id !== ctx.user.id) {
        await ctx.db.from('notifications').insert({
          recipient_id: review.reviewer_id,
          type: 'review_liked',
          payload: { review_id: review.id, liker_id: ctx.user.id },
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
        const { sortValue } = decodeCursor(input.cursor)
        if (sortValue) query = query.lt('created_at', sortValue)
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

      return paginateResults(enriched, input.limit, (item) => item.created_at)
    }),

  // 某賣家所有「顯示中」評價的星等分佈（用於評價分頁左側長條圖，需涵蓋全部而非單頁）
  getDistribution: publicProcedure
    .input(z.object({ seller_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const stars = [1, 2, 3, 4, 5] as const
      const counts = await Promise.all(
        stars.map(async (rating) => {
          const { count } = await ctx.db
            .from('reviews')
            .select('id', { count: 'exact', head: true })
            .eq('seller_id', input.seller_id)
            .eq('status', 'visible')
            .eq('rating', rating)
          return { stars: rating, count: count ?? 0 }
        })
      )
      return counts
    }),

  // 目前登入者對某賣家留的評價（沒有則回 null），用於決定顯示「撰寫」或「你的評價」
  getMyReviewForSeller: protectedProcedure
    .input(z.object({ seller_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.db
        .from('reviews')
        .select('*')
        .eq('seller_id', input.seller_id)
        .eq('reviewer_id', ctx.user.id)
        .maybeSingle()

      return data ?? null
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
        const { sortValue } = decodeCursor(input.cursor)
        if (sortValue) query = query.lt('created_at', sortValue)
      }

      query = query.limit(input.limit + 1)

      const { data, error } = await query
      if (error) throw error
      return paginateResults(data ?? [], input.limit, (item) => item.created_at)
    }),
})
