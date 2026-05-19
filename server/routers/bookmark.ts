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
            id, name, brand:brands(name), model_number, category, wish_count,
            catalog_image:product_images!fk_catalog_image(id, url, r2_key, thumbnail_url, thumbnail_r2_key),
            product_images:product_images!product_images_product_id_fkey(id, url, r2_key, thumbnail_url, thumbnail_r2_key)
          )
        `)
        .eq('user_id', ctx.user.id)
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

  isConnectionBookmarked: protectedProcedure
    .input(z.object({ connection_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.db
        .from('connection_bookmarks')
        .select('id')
        .eq('user_id', ctx.user.id)
        .eq('connection_id', input.connection_id)
        .maybeSingle()
      return { bookmarked: !!data }
    }),

  toggleConnectionBookmark: protectedProcedure
    .input(z.object({ connection_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: existing } = await ctx.db
        .from('connection_bookmarks')
        .select('id')
        .eq('user_id', ctx.user.id)
        .eq('connection_id', input.connection_id)
        .single()

      if (existing) {
        await ctx.db.from('connection_bookmarks').delete().eq('id', existing.id)
        return { bookmarked: false }
      }

      await ctx.db.from('connection_bookmarks').insert({
        user_id: ctx.user.id,
        connection_id: input.connection_id,
      })
      return { bookmarked: true }
    }),

  myConnectionBookmarks: protectedProcedure
    .input(z.object({
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('connection_bookmarks')
        .select(`
          id, created_at,
          connection:connections(
            id, title, start_date, end_date, shipping_date, can_wish,
            region:regions(id, name),
            seller:sellers(id, name),
            connection_images(id, url, r2_key, thumbnail_url, thumbnail_r2_key, sort_order)
          )
        `)
        .eq('user_id', ctx.user.id)
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
            id, price, is_price_on_request, shipping_date, status,
            product:products(id, name, brand:brands(name), model_number, catalog_image:product_images!fk_catalog_image(id, url, r2_key, thumbnail_url, thumbnail_r2_key), product_images:product_images!product_images_product_id_fkey(id, url, r2_key, thumbnail_url, thumbnail_r2_key)),
            seller:sellers(id, name),
            listing_images(url, r2_key, thumbnail_url, thumbnail_r2_key, sort_order)
          )
        `)
        .eq('user_id', ctx.user.id)
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
