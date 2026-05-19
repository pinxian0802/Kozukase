import { z } from 'zod'
import { SupabaseClient } from '@supabase/supabase-js'
import { router, publicProcedure, sellerProcedure } from '../trpc'

function calcTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

type CountFilter = { field: string; value: string | string[] }

async function countInPeriod(
  db: SupabaseClient,
  table: string,
  filters: CountFilter[],
  dateField: string,
  from: string,
  to?: string
): Promise<number> {
  if (filters.some(f => Array.isArray(f.value) && f.value.length === 0)) return 0

  let q = db.from(table).select('id', { count: 'exact', head: true })
  for (const { field, value } of filters) {
    q = Array.isArray(value) ? q.in(field, value) : q.eq(field, value)
  }
  q = q.gte(dateField, from)
  if (to) q = q.lt(dateField, to)
  const { count } = await q
  return count ?? 0
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
      const now = new Date()
      const curStart = new Date(now.getTime() - input.days * 86_400_000).toISOString()
      const prevStart = new Date(now.getTime() - input.days * 86_400_000 * 2).toISOString()

      const { data: myListings } = await ctx.db
        .from('listings')
        .select('id, product_id')
        .eq('seller_id', ctx.user.id)
      const listingIds = (myListings ?? []).map((l: any) => l.id)
      const productIds = [
        ...new Set((myListings ?? []).map((l: any) => l.product_id).filter(Boolean)),
      ] as string[]

      const sellerId = ctx.user.id

      const [
        listingViewsCur, listingViewsPrev,
        profileViewsCur, profileViewsPrev,
        igClicksCur, igClicksPrev,
        threadsClicksCur, threadsClicksPrev,
        inquiriesCur, inquiriesPrev,
        bookmarksCur, bookmarksPrev,
        followersCur, followersPrev,
        wishMatchesCur, wishMatchesPrev,
      ] = await Promise.all([
        countInPeriod(ctx.db, 'listing_views', [{ field: 'listing_id', value: listingIds }], 'viewed_at', curStart),
        countInPeriod(ctx.db, 'listing_views', [{ field: 'listing_id', value: listingIds }], 'viewed_at', prevStart, curStart),

        countInPeriod(ctx.db, 'profile_views', [{ field: 'seller_id', value: sellerId }], 'viewed_at', curStart),
        countInPeriod(ctx.db, 'profile_views', [{ field: 'seller_id', value: sellerId }], 'viewed_at', prevStart, curStart),

        countInPeriod(ctx.db, 'social_link_clicks', [{ field: 'seller_id', value: sellerId }, { field: 'platform', value: 'ig' }], 'clicked_at', curStart),
        countInPeriod(ctx.db, 'social_link_clicks', [{ field: 'seller_id', value: sellerId }, { field: 'platform', value: 'ig' }], 'clicked_at', prevStart, curStart),

        countInPeriod(ctx.db, 'social_link_clicks', [{ field: 'seller_id', value: sellerId }, { field: 'platform', value: 'threads' }], 'clicked_at', curStart),
        countInPeriod(ctx.db, 'social_link_clicks', [{ field: 'seller_id', value: sellerId }, { field: 'platform', value: 'threads' }], 'clicked_at', prevStart, curStart),

        countInPeriod(ctx.db, 'conversations', [{ field: 'seller_id', value: sellerId }], 'created_at', curStart),
        countInPeriod(ctx.db, 'conversations', [{ field: 'seller_id', value: sellerId }], 'created_at', prevStart, curStart),

        countInPeriod(ctx.db, 'listing_bookmarks', [{ field: 'listing_id', value: listingIds }], 'created_at', curStart),
        countInPeriod(ctx.db, 'listing_bookmarks', [{ field: 'listing_id', value: listingIds }], 'created_at', prevStart, curStart),

        countInPeriod(ctx.db, 'follows', [{ field: 'seller_id', value: sellerId }], 'created_at', curStart),
        countInPeriod(ctx.db, 'follows', [{ field: 'seller_id', value: sellerId }], 'created_at', prevStart, curStart),

        countInPeriod(ctx.db, 'wishes', [{ field: 'product_id', value: productIds }], 'created_at', curStart),
        countInPeriod(ctx.db, 'wishes', [{ field: 'product_id', value: productIds }], 'created_at', prevStart, curStart),
      ])

      return {
        listingViews:  { current: listingViewsCur,  trend: calcTrend(listingViewsCur,  listingViewsPrev) },
        profileViews:  { current: profileViewsCur,  trend: calcTrend(profileViewsCur,  profileViewsPrev) },
        igClicks:      { current: igClicksCur,      trend: calcTrend(igClicksCur,      igClicksPrev) },
        threadsClicks: { current: threadsClicksCur, trend: calcTrend(threadsClicksCur, threadsClicksPrev) },
        inquiries:     { current: inquiriesCur,     trend: calcTrend(inquiriesCur,     inquiriesPrev) },
        bookmarks:     { current: bookmarksCur,     trend: calcTrend(bookmarksCur,     bookmarksPrev) },
        newFollowers:  { current: followersCur,     trend: calcTrend(followersCur,     followersPrev) },
        wishMatches:   { current: wishMatchesCur,   trend: calcTrend(wishMatchesCur,   wishMatchesPrev) },
      }
    }),
})
