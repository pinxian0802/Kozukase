import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { searchProductsInput, browseProductsInput, createProductInput } from '@/lib/validators/product'
import { normalizeSearchText } from '@/lib/utils/search'
import { decodeCursor, paginateResults } from '@/lib/utils/pagination'

export const productRouter = router({
  // Instant search for listing/wish flow - returns up to 20 product names
  search: publicProcedure
    .input(searchProductsInput)
    .query(async ({ ctx, input }) => {
      const normalized = normalizeSearchText(input.query)
      
      const { data, error } = await ctx.db.rpc('search_products', {
        search_query: normalized,
        result_limit: input.limit,
      })

      if (error) throw error
      return data ?? []
    }),

  // Buyer browsing search with filters, sorting, cursor pagination
  browse: publicProcedure
    .input(browseProductsInput)
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('products')
        .select(`
          id, name, brand:brands(name), model_number, category, wish_count, created_at,
          catalog_image:product_images!fk_catalog_image(id, url, r2_key),
          product_images:product_images!product_images_product_id_fkey(id, url, r2_key),
          listings!inner(id, price, is_price_on_request, shipping_days, created_at,
            seller:sellers!inner(id, is_social_verified, is_suspended)
          )
        `)
        .eq('is_removed', false)
        .eq('listings.status', 'active')
        .eq('listings.seller.is_suspended', false)

      // Apply filters
      if (input.query) {
        const normalized = normalizeSearchText(input.query)
        const { data: matchingIds } = await ctx.db.rpc('search_product_ids', {
          search_query: normalized,
        })
        const ids = (matchingIds ?? []).map((r: { id: string }) => r.id)
        if (ids.length === 0) {
          return { items: [], nextCursor: null }
        }
        query = query.in('id', ids)
      }
      if (input.category) {
        query = query.eq('category', input.category)
      }
      if (input.priceMin !== undefined) {
        query = query.gte('listings.price', input.priceMin)
      }
      if (input.priceMax !== undefined) {
        query = query.lte('listings.price', input.priceMax)
      }
      if (input.shippingDaysMax !== undefined) {
        query = query.lte('listings.shipping_days', input.shippingDaysMax)
      }
      if (input.socialVerifiedOnly) {
        query = query.eq('listings.seller.is_social_verified', true)
      }
      if (input.region) {
        const { data: regionSellers } = await ctx.db
          .from('seller_regions')
          .select('seller_id')
          .eq('region_id', input.region)
        const sellerIds = (regionSellers ?? []).map((r: { seller_id: string }) => r.seller_id)
        if (sellerIds.length === 0) {
          return { items: [], nextCursor: null }
        }
        query = query.in('listings.seller_id', sellerIds)
      }

      // Sorting
      if (input.sort === 'price_asc') {
        query = query.order('price', { ascending: true, referencedTable: 'listings' })
      } else {
        query = query.order('created_at', { ascending: false, referencedTable: 'listings' })
      }

      // Cursor pagination
      if (input.cursor) {
        const { id } = decodeCursor(input.cursor)
        query = query.lt('id', id)
      }

      query = query.limit(input.limit + 1)

      const { data, error } = await query
      if (error) throw error

      return paginateResults(data ?? [], input.limit)
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: product, error } = await ctx.db
        .from('products')
        .select(`
          *,
          brand:brands(name),
          catalog_image:product_images!fk_catalog_image(id, url, r2_key),
          product_images:product_images!product_images_product_id_fkey(id, url, r2_key),
          listings(
            id, price, is_price_on_request, specs, note, post_url, 
            shipping_days, expires_at, status, created_at,
            seller:sellers(
              id, name, ig_handle, threads_handle, ig_follower_count, 
              threads_follower_count, is_social_verified, avg_rating, review_count
            ),
            listing_images(id, url, r2_key, sort_order)
          )
        `)
        .eq('id', input.id)
        .eq('is_removed', false)
        .eq('listings.status', 'active')
        .single()

      if (error || !product) {
        throw new Error('商品不存在')
      }

      // Get wish count
      const wishCount = product.wish_count

      // Check if current user has wished/bookmarked (if logged in)
      let hasWished = false
      let hasBookmarked = false
      if (ctx.user) {
        const [wishResult, bookmarkResult] = await Promise.all([
          ctx.db.from('wishes').select('id').eq('user_id', ctx.user.id).eq('product_id', input.id).single(),
          ctx.db.from('product_bookmarks').select('id').eq('user_id', ctx.user.id).eq('product_id', input.id).single(),
        ])
        hasWished = !!wishResult.data
        hasBookmarked = !!bookmarkResult.data
      }

      return { ...product, hasWished, hasBookmarked, wishCount }
    }),

  create: protectedProcedure
    .input(createProductInput)
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.db
        .from('products')
        .insert({
          name: input.name,
          brand_id: input.brand_id || null,
          model_number: input.model_number || null,
          category: input.category || null,
          region_id: input.region_id || null,
          created_by: ctx.user.id,
        })
        .select()
        .single()

      if (error) throw error
      return data
    }),
})
