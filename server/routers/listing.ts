import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { router, publicProcedure, sellerProcedure } from '../trpc'
import { httpUrl } from '@/lib/validators/common'
import { createListingInput, updateListingInput, browseListingsInput } from '@/lib/validators/listing'
import { decodeCursor, paginateResults } from '@/lib/utils/pagination'
import { checkUrlSafety } from '@/lib/utils/safe-browsing'
import { normalizeSearchText } from '@/lib/utils/search'

export const listingRouter = router({
  browse: publicProcedure
    .input(browseListingsInput)
    .query(async ({ ctx, input }) => {
      let productIds: string[] | null = null

      if (input.query) {
        const normalized = normalizeSearchText(input.query)
        const { data: matchingIds } = await ctx.db.rpc('search_product_ids', {
          search_query: normalized,
        })
        const ids: string[] = (matchingIds ?? []).map((r: { id: string }) => r.id)
        if (ids.length === 0) {
          return { items: [], total: 0, page: input.page, totalPages: 0 }
        }
        productIds = ids
      }

      if (input.category || input.brandId) {
        let productQuery = ctx.db
          .from('products')
          .select('id')
          .eq('is_removed', false)
        if (input.category) productQuery = productQuery.eq('category', input.category)
        if (input.brandId) productQuery = productQuery.eq('brand_id', input.brandId)
        if (productIds !== null) productQuery = productQuery.in('id', productIds)

        const { data: filtered } = await productQuery
        const filteredIds: string[] = (filtered ?? []).map((p: { id: string }) => p.id)
        if (filteredIds.length === 0) {
          return { items: [], total: 0, page: input.page, totalPages: 0 }
        }
        productIds = filteredIds
      }

      let query = ctx.db
        .from('listings')
        .select(
          `id, title, price, is_price_on_request, is_in_stock, shipping_date, created_at, specs,
          listing_images(url, thumbnail_url, sort_order),
          seller:sellers(id, name, avg_rating, review_count, is_social_verified, can_provide_proof, avatar_url, ig_handle, threads_handle)`,
          { count: 'exact' }
        )
        .eq('status', 'active')
        .eq('seller.is_suspended', false)

      if (productIds !== null) {
        query = query.in('product_id', productIds)
      }

      if (input.socialVerifiedOnly) {
        const { data: verifiedSellers } = await ctx.db
          .from('sellers')
          .select('id')
          .eq('is_social_verified', true)
        const ids = (verifiedSellers ?? []).map((r) => r.id)
        const safeIds = ids.length ? ids : ['00000000-0000-0000-0000-000000000000']
        query = query.in('seller_id', safeIds)
      }

      if (input.inStockOnly) {
        query = query.eq('is_in_stock', true)
      }

      if (input.proofOnly) {
        const { data: proofSellers } = await ctx.db
          .from('sellers')
          .select('id')
          .eq('can_provide_proof', true)
        const ids = (proofSellers ?? []).map((r) => r.id)
        const safeIds = ids.length ? ids : ['00000000-0000-0000-0000-000000000000']
        query = query.in('seller_id', safeIds)
      }

      const offset = (input.page - 1) * input.limit
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + input.limit - 1)

      const { data, error, count } = await query
      if (error) throw error

      const total = count ?? 0
      return {
        items: data ?? [],
        total,
        page: input.page,
        totalPages: Math.ceil(total / input.limit),
      }
    }),

  checkPostUrl: sellerProcedure
    .input(z.object({ url: httpUrl }))
    .mutation(async ({ input }) => {
      return checkUrlSafety(input.url)
    }),

  create: sellerProcedure
    .input(createListingInput)
    .mutation(async ({ ctx, input }) => {
      // Check listing limit (25 max)
      const { count } = await ctx.db
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', ctx.seller.id)
      
      if ((count ?? 0) >= 25) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Listing 數量已達上限（25 個）' })
      }

      const { data, error } = await ctx.db
        .from('listings')
        .insert({
          product_id: input.product_id,
          title: input.title,
          seller_id: ctx.seller.id,
          status: input.status,
          price: input.price ?? null,
          is_price_on_request: input.is_price_on_request,
          is_in_stock: input.is_in_stock,
          specs: input.specs,
          note: input.note ?? null,
          post_url: input.post_url ?? '',
          shipping_date: input.shipping_date ?? null,
          expires_at: input.expires_at ?? null,
        })
        .select()
        .single()

      if (error) throw error

      // If publishing (active), send notifications
      if (input.status === 'active') {
        await sendNewListingNotifications(ctx.db, data.id, input.product_id)
      }

      return data
    }),

  update: sellerProcedure
    .input(updateListingInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input

      // Verify ownership
      const { data: existing } = await ctx.db
        .from('listings')
        .select('seller_id, status')
        .eq('id', id)
        .single()

      if (!existing || existing.seller_id !== ctx.seller.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Listing 不存在' })
      }

      const { data, error } = await ctx.db
        .from('listings')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    }),

  publish: sellerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: listing } = await ctx.db
        .from('listings')
        .select('*')
        .eq('id', input.id)
        .eq('seller_id', ctx.seller.id)
        .single()

      if (!listing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Listing 不存在' })
      }

      if (listing.status !== 'draft') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只有草稿可以發布' })
      }

      // Validate required fields for publish
      if (!listing.post_url) throw new TRPCError({ code: 'BAD_REQUEST', message: '貼文連結為必填' })

      // Safe Browsing double-check on publish
      const urlCheck = await checkUrlSafety(listing.post_url)
      if (!urlCheck.safe) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `此貼文連結被 Google 標記為危險網站（${urlCheck.threat}），請改用其他連結`,
        })
      }
      if (!listing.shipping_date) throw new TRPCError({ code: 'BAD_REQUEST', message: '出貨日期為必填' })
      if (listing.price === null && !listing.is_price_on_request) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '請填寫價格或選擇私訊報價' })
      }

      const { data, error } = await ctx.db
        .from('listings')
        .update({ status: 'active' })
        .eq('id', input.id)
        .select()
        .single()

      if (error) throw error

      await sendNewListingNotifications(ctx.db, data.id, data.product_id)
      return data
    }),

  delete: sellerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: listing } = await ctx.db
        .from('listings')
        .select('status, seller_id')
        .eq('id', input.id)
        .single()

      if (!listing || listing.seller_id !== ctx.seller.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }
      if (listing.status !== 'draft' && listing.status !== 'inactive') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只能刪除草稿或已下架的代購' })
      }

      await ctx.db.from('listing_images').delete().eq('listing_id', input.id)
      await ctx.db.from('listings').delete().eq('id', input.id)
      return { success: true }
    }),

  deactivate: sellerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.db
        .from('listings')
        .update({ status: 'inactive', inactive_reason: 'self' })
        .eq('id', input.id)
        .eq('seller_id', ctx.seller.id)
        .eq('status', 'active')
        .select()
        .single()

      if (error || !data) throw new TRPCError({ code: 'NOT_FOUND' })
      return data
    }),

  reactivate: sellerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: listing } = await ctx.db
        .from('listings')
        .select('*, product:products(is_removed)')
        .eq('id', input.id)
        .eq('seller_id', ctx.seller.id)
        .single()

      if (!listing) throw new TRPCError({ code: 'NOT_FOUND' })
      if (listing.status !== 'inactive') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只有已下架的 Listing 可以重新上架' })
      }

      // Gate on the CURRENT product: if it is still removed, the seller must
      // reselect a valid product (done via update) before reactivating.
      const product = Array.isArray(listing.product) ? listing.product[0] : listing.product
      if (product?.is_removed) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '原商品已被移除，請重新選擇商品' })
      }

      // admin- or product_removed-originated downs require re-approval;
      // self / expired go straight back to active.
      const newStatus =
        listing.inactive_reason === 'admin' || listing.inactive_reason === 'product_removed'
          ? 'pending_approval'
          : 'active'

      const { data, error } = await ctx.db
        .from('listings')
        .update({ status: newStatus, inactive_reason: null })
        .eq('id', input.id)
        .select()
        .single()

      if (error) throw error
      return data
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.db
        .from('listings')
        .select(`
          *,
          product:products(id, name, is_removed, brand:brands(name), model_number, category, catalog_image:product_images!fk_catalog_image(id, url, r2_key, thumbnail_url, thumbnail_r2_key), product_images:product_images!product_images_product_id_fkey(id, url, r2_key, thumbnail_url, thumbnail_r2_key)),
          seller:sellers(
            id, name, ig_handle, threads_handle, is_social_verified, avg_rating, review_count, avatar_url,
            seller_regions(region:regions(id, name)),
            profile:profiles(username, last_seen_at)
          ),
          listing_images(id, url, r2_key, thumbnail_url, thumbnail_r2_key, sort_order)
        `)
        .eq('id', input.id)
        .single()

      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      const isOwner = ctx.user?.id === data.seller_id

      if (data.status === 'draft' && !isOwner) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      // Check seller suspension
      if (data.seller?.is_suspended && !isOwner) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      let hasBookmarked = false
      if (ctx.user) {
        const { data: bookmark } = await ctx.db
          .from('listing_bookmarks')
          .select('id')
          .eq('user_id', ctx.user.id)
          .eq('listing_id', input.id)
          .single()
        hasBookmarked = !!bookmark
      }

      return { ...data, hasBookmarked }
    }),

  // Seller dashboard - my listings
  myListings: sellerProcedure
    .input(z.object({
      status: z.enum(['draft', 'active', 'inactive', 'pending_approval']).optional(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('listings')
        .select(`
          *, 
          product:products(id, name, is_removed, brand:brands(name), model_number, catalog_image:product_images!fk_catalog_image(id, url, r2_key, thumbnail_url, thumbnail_r2_key), product_images:product_images!product_images_product_id_fkey(id, url, r2_key, thumbnail_url, thumbnail_r2_key)),
          listing_images(id, url, r2_key, thumbnail_url, thumbnail_r2_key, sort_order)
        `)
        .eq('seller_id', ctx.seller.id)
        .order('created_at', { ascending: false })

      if (input.status) {
        query = query.eq('status', input.status)
      }

      if (input.cursor) {
        const { sortValue } = decodeCursor(input.cursor)
        if (sortValue) query = query.lt('created_at', sortValue)
      }

      query = query.limit(input.limit + 1)

      const { data, error } = await query
      if (error) throw error

      return paginateResults(data ?? [], input.limit, (item) => item.created_at)
    }),

  // Count for seller - how many listings total
  myListingCount: sellerProcedure.query(async ({ ctx }) => {
    const { count: total } = await ctx.db
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', ctx.seller.id)

    const { count: active } = await ctx.db
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', ctx.seller.id)
      .eq('status', 'active')

    const { count: draft } = await ctx.db
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', ctx.seller.id)
      .eq('status', 'draft')

    const { count: pending_approval } = await ctx.db
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', ctx.seller.id)
      .eq('status', 'pending_approval')

    const { count: inactive } = await ctx.db
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', ctx.seller.id)
      .eq('status', 'inactive')

    return { total: total ?? 0, active: active ?? 0, draft: draft ?? 0, pending_approval: pending_approval ?? 0, inactive: inactive ?? 0, max: 25 }
  }),
})

// Helper to send notifications when a new listing is published
async function sendNewListingNotifications(
  db: SupabaseClient<any>,
  listingId: string,
  productId: string
) {
  // Notify wish users
  const { data: wishUsers } = await db
    .from('wishes')
    .select('user_id')
    .eq('product_id', productId)

  if (wishUsers?.length) {
    const { data: product } = await db
      .from('products')
      .select('name')
      .eq('id', productId)
      .maybeSingle()

    const wishNotifications = wishUsers.map((w: { user_id: string }) => ({
      recipient_id: w.user_id,
      type: 'new_listing_for_wish',
      payload: { listing_id: listingId, product_id: productId, product_name: product?.name ?? null },
    }))
    await db.from('notifications').insert(wishNotifications)
  }
}
