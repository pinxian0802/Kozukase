import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure, sellerProcedure } from '../trpc'
import { becomeSellerInput, updateSellerInput } from '@/lib/validators/seller'

export const sellerRouter = router({
  becomeSeller: protectedProcedure
    .input(becomeSellerInput)
    .mutation(async ({ ctx, input }) => {
      // Check if already a seller
      const { data: existing } = await ctx.db
        .from('sellers')
        .select('id')
        .eq('id', ctx.user.id)
        .single()

      if (existing) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '您已經是賣家' })
      }

      // Create seller record
      const { data: seller, error } = await ctx.db
        .from('sellers')
        .insert({
          id: ctx.user.id,
          name: input.name,
          phone_number: input.phone_number,
          phone_verified: true, // TODO: implement OTP verification
        })
        .select()
        .single()

      if (error) throw error

      // Insert seller regions
      if (input.region_ids.length > 0) {
        const regions = input.region_ids.map(regionId => ({
          seller_id: ctx.user.id,
          region_id: regionId,
        }))
        await ctx.db.from('seller_regions').insert(regions)
      }

      return seller
    }),

  update: sellerProcedure
    .input(updateSellerInput)
    .mutation(async ({ ctx, input }) => {
      const { region_ids, ...sellerData } = input

      // Update social verification status
      if (sellerData.ig_handle !== undefined || sellerData.threads_handle !== undefined) {
        const currentSeller = ctx.seller
        const hasIg = sellerData.ig_handle || currentSeller.ig_handle
        const hasThreads = sellerData.threads_handle || currentSeller.threads_handle

        Object.assign(sellerData, {
          is_social_verified: !!(hasIg || hasThreads),
          social_connected_at: (hasIg || hasThreads) ? new Date().toISOString() : null,
        })
      }

      const { data, error } = await ctx.db
        .from('sellers')
        .update(sellerData)
        .eq('id', ctx.seller.id)
        .select()
        .single()

      if (error) throw error

      // Update regions if provided
      if (region_ids) {
        await ctx.db.from('seller_regions').delete().eq('seller_id', ctx.seller.id)
        if (region_ids.length > 0) {
          const regions = region_ids.map(regionId => ({
            seller_id: ctx.seller.id,
            region_id: regionId,
          }))
          await ctx.db.from('seller_regions').insert(regions)
        }
      }

      return data
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.db
        .from('sellers')
        .select(`
          *,
          profile:profiles(display_name, avatar_url),
          seller_regions(region:regions(id, name))
        `)
        .eq('id', input.id)
        .eq('is_suspended', false)
        .single()

      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '賣家不存在' })
      }

      let isFollowing = false
      if (ctx.user) {
        const { data: follow } = await ctx.db
          .from('follows')
          .select('id')
          .eq('follower_id', ctx.user.id)
          .eq('seller_id', input.id)
          .single()
        isFollowing = !!follow
      }

      return { ...data, isFollowing }
    }),

  getListings: publicProcedure
    .input(z.object({
      sellerId: z.string().uuid(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('listings')
        .select(`
          *, 
          product:products(id, name, brand),
          listing_images(id, url, sort_order)
        `)
        .eq('seller_id', input.sellerId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (input.cursor) {
        const { id } = await import('@/lib/utils/pagination').then(m => m.decodeCursor(input.cursor!))
        query = query.lt('id', id)
      }

      query = query.limit(input.limit + 1)

      const { data, error } = await query
      if (error) throw error

      const { paginateResults } = await import('@/lib/utils/pagination')
      return paginateResults(data ?? [], input.limit)
    }),

  getRegions: publicProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.db
      .from('regions')
      .select('*')
      .order('name')

    if (error) throw error
    return data ?? []
  }),
})
