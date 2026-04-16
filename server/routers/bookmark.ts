import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { decodeCursor, paginateResults } from '@/lib/utils/pagination'

export const bookmarkRouter = router({
  toggleProductBookmark: protectedProcedure
    .input(z.object({ product_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: existing } = await ctx.db
        .from('product_bookmarks')
        .select('id')
        .eq('user_id', ctx.user.id)
        .eq('product_id', input.product_id)
        .single()

      if (existing) {
        await ctx.db.from('product_bookmarks').delete().eq('id', existing.id)
        return { bookmarked: false }
      }

      await ctx.db.from('product_bookmarks').insert({
        user_id: ctx.user.id,
        product_id: input.product_id,
      })
      return { bookmarked: true }
    }),

  toggleListingBookmark: protectedProcedure
    .input(z.object({ listing_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: existing } = await ctx.db
        .from('listing_bookmarks')
        .select('id')
        .eq('user_id', ctx.user.id)
        .eq('listing_id', input.listing_id)
        .single()

      if (existing) {
        await ctx.db.from('listing_bookmarks').delete().eq('id', existing.id)
        return { bookmarked: false }
      }

      await ctx.db.from('listing_bookmarks').insert({
        user_id: ctx.user.id,
        listing_id: input.listing_id,
      })
      return { bookmarked: true }
    }),

  myProductBookmarks: protectedProcedure
    .input(z.object({
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('product_bookmarks')
        .select(`
          id, created_at,
          product:products(
            id, name, brand, category, wish_count,
            catalog_image:product_images!fk_catalog_image(url),
            product_images:product_images!product_images_product_id_fkey(id, url)
          )
        `)
        .eq('user_id', ctx.user.id)
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

  myListingBookmarks: protectedProcedure
    .input(z.object({
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('listing_bookmarks')
        .select(`
          id, created_at,
          listing:listings(
            id, price, is_price_on_request, shipping_days, status,
            product:products(id, name, catalog_image:product_images!fk_catalog_image(url), product_images:product_images!product_images_product_id_fkey(id, url)),
            seller:sellers(id, name),
            listing_images(url, sort_order)
          )
        `)
        .eq('user_id', ctx.user.id)
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
