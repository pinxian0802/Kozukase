import { z } from 'zod'
import { router, publicProcedure, sellerProcedure } from '../trpc'

function calcTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

// seller_dashboard_stats RPC（migration add_seller_dashboard_stats_fn）的回傳列。
// 不在產生的 Supabase 型別內，故手動定義；所有計數以字串/數字回傳，統一轉 Number。
type SellerStatsRow = {
  listing_views_cur: number; listing_views_prev: number
  profile_views_cur: number; profile_views_prev: number
  ig_clicks_cur: number; ig_clicks_prev: number
  threads_clicks_cur: number; threads_clicks_prev: number
  inquiries_cur: number; inquiries_prev: number
  bookmarks_cur: number; bookmarks_prev: number
  followers_cur: number; followers_prev: number
  wish_matches_cur: number; wish_matches_prev: number
  product_views_cur: number; product_views_prev: number
  connection_views_cur: number; connection_views_prev: number
}

export const analyticsRouter = router({
  recordListingView: publicProcedure
    .input(z.object({ listing_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.from('listing_views').insert({
        listing_id: input.listing_id,
        viewer_id: ctx.user?.id ?? null,
      })
    }),

  recordProfileView: publicProcedure
    .input(z.object({ seller_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.from('profile_views').insert({
        seller_id: input.seller_id,
        viewer_id: ctx.user?.id ?? null,
      })
    }),

  recordProductView: publicProcedure
    .input(z.object({ product_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.from('product_views').insert({
        product_id: input.product_id,
        viewer_id: ctx.user?.id ?? null,
      })
    }),

  recordConnectionView: publicProcedure
    .input(z.object({ connection_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.from('connection_views').insert({
        connection_id: input.connection_id,
        viewer_id: ctx.user?.id ?? null,
      })
    }),

  recordSocialClick: publicProcedure
    .input(z.object({
      seller_id: z.string().uuid(),
      platform: z.enum(['ig', 'threads']),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.from('social_link_clicks').insert({
        seller_id: input.seller_id,
        platform: input.platform,
        clicker_id: ctx.user?.id ?? null,
      })
    }),

  getSellerStats: sellerProcedure
    .input(z.object({
      days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const now = Date.now()
      const curStart = new Date(now - input.days * 86_400_000).toISOString()
      const prevStart = new Date(now - input.days * 86_400_000 * 2).toISOString()

      // 單一聚合 RPC 取代原本 22 支 count 查詢；視窗邊界由此處傳入，語義不變。
      const { data, error } = await ctx.db.rpc('seller_dashboard_stats', {
        p_seller_id: ctx.user.id,
        p_cur_start: curStart,
        p_prev_start: prevStart,
      })
      if (error) throw error

      const row = (Array.isArray(data) ? data[0] : data) as SellerStatsRow | undefined
      const n = (v: number | undefined) => Number(v ?? 0)
      const stat = (cur: number | undefined, prev: number | undefined) => {
        const c = n(cur)
        const p = n(prev)
        return { current: c, trend: calcTrend(c, p) }
      }

      return {
        listingViews:    stat(row?.listing_views_cur,    row?.listing_views_prev),
        profileViews:    stat(row?.profile_views_cur,    row?.profile_views_prev),
        igClicks:        stat(row?.ig_clicks_cur,        row?.ig_clicks_prev),
        threadsClicks:   stat(row?.threads_clicks_cur,   row?.threads_clicks_prev),
        inquiries:       stat(row?.inquiries_cur,        row?.inquiries_prev),
        bookmarks:       stat(row?.bookmarks_cur,        row?.bookmarks_prev),
        newFollowers:    stat(row?.followers_cur,        row?.followers_prev),
        wishMatches:     stat(row?.wish_matches_cur,     row?.wish_matches_prev),
        productViews:    stat(row?.product_views_cur,    row?.product_views_prev),
        connectionViews: stat(row?.connection_views_cur, row?.connection_views_prev),
      }
    }),
})
