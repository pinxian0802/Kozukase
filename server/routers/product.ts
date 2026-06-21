import { z } from 'zod'
import { addDays, format } from 'date-fns'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { searchProductsInput, browseProductsInput, createProductInput } from '@/lib/validators/product'
import { normalizeSearchText } from '@/lib/utils/search'

// search_products RPC is not in the generated Supabase types, so ctx.db.rpc
// returns `any`. Shape mirrors the RETURNS TABLE in migration 00016_fix_search.
type ProductSearchRow = {
  id: string
  name: string
  brand: string | null
  category: string | null
  model_number: string | null
  catalog_image_url: string | null
  wish_count: number | null
  similarity_score: number
}

type PopularProductRow = {
  id: string
  name: string
  brand: string | null
  category: string | null
  model_number: string | null
  catalog_image_url: string | null
  wish_count: number | null
  view_count: number
}

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
      return (data ?? []) as ProductSearchRow[]
    }),

  // Buyer browsing search with filters, sorting, offset pagination
  browse: publicProcedure
    .input(browseProductsInput)
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('products')
        .select(`
          id, name, brand:brands(name), model_number, category, wish_count, created_at,
          catalog_image:product_images!fk_catalog_image(id, url, r2_key, thumbnail_url, thumbnail_r2_key),
          product_images:product_images!product_images_product_id_fkey(id, url, r2_key, thumbnail_url, thumbnail_r2_key, sort_order),
          listings!inner(price, shipping_date, status, seller_id, seller:sellers!inner(is_social_verified, can_provide_proof))
        `, { count: 'exact' })
        .eq('is_removed', false)
        // 只計入有「上架中」刊登的商品；同時讓下方對 listings 的篩選真正生效
        .eq('listings.status', 'active')

      // Apply filters
      if (input.query) {
        const normalized = normalizeSearchText(input.query)
        const { data: matchingIds } = await ctx.db.rpc('search_product_ids', {
          search_query: normalized,
        })
        const ids = (matchingIds ?? []).map((r: { id: string }) => r.id)
        if (ids.length === 0) {
          return { items: [], total: 0, page: input.page, totalPages: 0 }
        }
        query = query.in('id', ids)
      }
      if (input.category) {
        query = query.eq('category', input.category)
      }
      if (input.brandId) {
        query = query.eq('brand_id', input.brandId)
      }
      if (input.priceMin !== undefined) {
        query = query.gte('listings.price', input.priceMin)
      }
      if (input.priceMax !== undefined) {
        query = query.lte('listings.price', input.priceMax)
      }
      if (input.shippingDaysMax !== undefined) {
        const shippingDateMax = format(addDays(new Date(), input.shippingDaysMax), 'yyyy-MM-dd')
        query = query.lte('listings.shipping_date', shippingDateMax)
      }
      if (input.socialVerifiedOnly) {
        query = query.eq('listings.seller.is_social_verified', true)
      }
      if (input.proofOnly) {
        query = query.eq('listings.seller.can_provide_proof', true)
      }
      if (input.region) {
        const { data: regionSellers } = await ctx.db
          .from('seller_regions')
          .select('seller_id')
          .eq('region_id', input.region)
        const sellerIds = (regionSellers ?? []).map((r: { seller_id: string }) => r.seller_id)
        if (sellerIds.length === 0) {
          return { items: [], total: 0, page: input.page, totalPages: 0 }
        }
        query = query.in('listings.seller_id', sellerIds)
      }

      // Sort by product creation date (newest products first)
      query = query.order('created_at', { ascending: false })

      // Offset pagination
      const offset = (input.page - 1) * input.limit
      query = query.range(offset, offset + input.limit - 1)

      const { data, error, count } = await query
      if (error) throw error

      const total = count ?? 0
      // Supabase types embedded relations as arrays; collapse the to-one
      // joins (brand / catalog_image) so the shape matches ProductCardProduct.
      const items = (data ?? []).map(({ listings: _listings, ...p }) => ({
        ...p,
        brand: Array.isArray(p.brand) ? p.brand[0] ?? null : p.brand,
        catalog_image: Array.isArray(p.catalog_image)
          ? p.catalog_image[0] ?? null
          : p.catalog_image,
      }))
      return {
        items,
        total,
        page: input.page,
        totalPages: Math.ceil(total / input.limit),
      }
    }),

  popular: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(24).default(12) }).optional())
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.db.rpc('popular_products', {
        result_limit: input?.limit ?? 12,
      })
      if (error) throw error
      return (data ?? []) as PopularProductRow[]
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: product, error } = await ctx.db
        .from('products')
        .select(`
          *,
          brand:brands(name),
          catalog_image:product_images!fk_catalog_image(id, url, r2_key, thumbnail_url, thumbnail_r2_key),
          product_images:product_images!product_images_product_id_fkey(id, url, r2_key, thumbnail_url, thumbnail_r2_key, sort_order),
          listings(
            id, title, price, is_price_on_request, is_in_stock, specs, note, post_url,
            shipping_date, expires_at, status, created_at,
            seller:sellers(
              id, name, ig_handle, threads_handle, is_social_verified, avg_rating, review_count, avatar_url
            ),
            listing_images(id, url, r2_key, thumbnail_url, thumbnail_r2_key, sort_order)
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
