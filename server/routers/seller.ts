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

  getSelf: sellerProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.db
      .from('sellers')
      .select('*')
      .eq('id', ctx.seller.id)
      .single()

    if (error) throw error
    return data
  }),

  disconnectSocial: sellerProcedure
    .input(z.object({ platform: z.enum(['instagram', 'threads']) }))
    .mutation(async ({ ctx, input }) => {
      const sellerId = ctx.seller.id

      // Delete social token
      await ctx.db
        .from('social_tokens')
        .delete()
        .eq('seller_id', sellerId)
        .eq('platform', input.platform)

      // Clear seller fields for this platform
      const clearData: Record<string, null | boolean> = {}
      if (input.platform === 'instagram') {
        clearData.ig_handle = null
        clearData.ig_follower_count = null
        clearData.ig_connected_at = null
      } else {
        clearData.threads_handle = null
        clearData.threads_follower_count = null
        clearData.threads_connected_at = null
      }

      // Recalculate is_social_verified based on whether the other platform is still connected
      const otherPlatform = input.platform === 'instagram' ? 'threads' : 'instagram'
      const { data: otherToken } = await ctx.db
        .from('social_tokens')
        .select('id')
        .eq('seller_id', sellerId)
        .eq('platform', otherPlatform)
        .maybeSingle()

      clearData.is_social_verified = !!otherToken

      const { error } = await ctx.db
        .from('sellers')
        .update(clearData)
        .eq('id', sellerId)

      if (error) throw error

      return { success: true }
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
          product:products(id, name, brand, model_number),
          listing_images(id, url, r2_key, sort_order)
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
