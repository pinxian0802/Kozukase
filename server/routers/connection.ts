import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, sellerProcedure } from '../trpc'
import { createConnectionInput, updateConnectionInput } from '@/lib/validators/connection'
import { decodeCursor, paginateResults } from '@/lib/utils/pagination'

export const connectionRouter = router({
  create: sellerProcedure
    .input(createConnectionInput)
    .mutation(async ({ ctx, input }) => {
      // Check limit (5 max)
      const { count } = await ctx.db
        .from('connections')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', ctx.seller.id)

      if ((count ?? 0) >= 5) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '連線公告數量已達上限（5 個）' })
      }

      const { data, error } = await ctx.db
        .from('connections')
        .insert({
          seller_id: ctx.seller.id,
          region_id: input.region_id,
          locations: input.locations ?? [],
          start_date: input.start_date,
          end_date: input.end_date,
          shipping_date: input.shipping_date,
          description: input.description ?? null,
          status: 'active',
        })
        .select()
        .single()

      if (error) throw error

      if (input.brand_ids && input.brand_ids.length > 0) {
        await ctx.db.from('connection_brands').insert(
          input.brand_ids.map((brand_id) => ({ connection_id: data.id, brand_id }))
        )
      }

      return data
    }),

  update: sellerProcedure
    .input(updateConnectionInput)
    .mutation(async ({ ctx, input }) => {
      const { id, brand_ids, ...updateData } = input

      const { data, error } = await ctx.db
        .from('connections')
        .update(updateData)
        .eq('id', id)
        .eq('seller_id', ctx.seller.id)
        .select()
        .single()

      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '連線公告不存在' })
      }

      if (brand_ids !== undefined) {
        await ctx.db.from('connection_brands').delete().eq('connection_id', id)
        if (brand_ids.length > 0) {
          await ctx.db.from('connection_brands').insert(
            brand_ids.map((brand_id) => ({ connection_id: id, brand_id }))
          )
        }
      }

      return data
    }),

  end: sellerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.db
        .from('connections')
        .update({ status: 'ended', ended_reason: 'self' })
        .eq('id', input.id)
        .eq('seller_id', ctx.seller.id)
        .eq('status', 'active')
        .select()
        .single()

      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }
      return data
    }),

  reactivate: sellerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: connection } = await ctx.db
        .from('connections')
        .select('*')
        .eq('id', input.id)
        .eq('seller_id', ctx.seller.id)
        .single()

      if (!connection) throw new TRPCError({ code: 'NOT_FOUND' })
      if (connection.status !== 'ended') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只有已結束的連線可以重新申請' })
      }

      const newStatus = connection.ended_reason === 'admin' ? 'pending_approval' : 'active'

      const { data, error } = await ctx.db
        .from('connections')
        .update({ status: newStatus, ended_reason: null })
        .eq('id', input.id)
        .select()
        .single()

      if (error) throw error
      return data
    }),

  // Hard-delete a connection owned by this seller.
  // Used as compensating rollback when the create flow fails after the DB
  // record was already inserted (e.g. image upload error).
  // Note: reports.connection_id has NO DELETE CASCADE, so this will fail if
  // a report already references the connection — which can't happen in the
  // milliseconds between create and rollback.
  delete: sellerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: connection } = await ctx.db
        .from('connections')
        .select('seller_id')
        .eq('id', input.id)
        .single()

      if (!connection || connection.seller_id !== ctx.seller.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      const { error } = await ctx.db
        .from('connections')
        .delete()
        .eq('id', input.id)

      if (error) throw error
      return { success: true }
    }),

  getBySeller: publicProcedure
    .input(z.object({ sellerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.db
        .from('connections')
        .select(`
          *,
          region:regions(id, name),
          connection_images(id, url, r2_key, thumbnail_url, thumbnail_r2_key, sort_order)
        `)
        .eq('seller_id', input.sellerId)
        .eq('status', 'active')
        .order('start_date', { ascending: true })

      if (error) throw error
      return data ?? []
    }),

  // Public browse page
  browse: publicProcedure
    .input(z.object({
      region_id: z.string().uuid().optional(),
      location_query: z.string().max(50).optional(),
      active_during: z.object({
        start: z.string().optional(),
        end: z.string().optional(),
      }).optional(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('connections')
        .select(`
          *,
          region:regions(id, name),
          seller:sellers(
            id, name, ig_handle, threads_handle, is_social_verified,
            profile:profiles(display_name, avatar_url)
          ),
          connection_images(id, url, r2_key, thumbnail_url, thumbnail_r2_key, sort_order)
        `)
        .eq('status', 'active')
        .eq('seller.is_suspended', false)
        .order('start_date', { ascending: true })

      if (input.region_id) {
        query = query.eq('region_id', input.region_id)
      }

      if (input.location_query) {
        query = query.filter('locations::text', 'ilike', `%${input.location_query}%`)
      }

      if (input.cursor) {
        const { id } = decodeCursor(input.cursor)
        query = query.gt('id', id)
      }

      query = query.limit(input.limit + 1)

      const { data, error } = await query
      if (error) throw error
      return paginateResults(data ?? [], input.limit)
    }),

  // Seller dashboard
  myConnections: sellerProcedure
    .input(z.object({
      status: z.enum(['active', 'ended', 'pending_approval']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('connections')
        .select(`
          *,
          region:regions(id, name),
          connection_images(id, url, r2_key, thumbnail_url, thumbnail_r2_key, sort_order),
          connection_brands(brand_id)
        `)
        .eq('seller_id', ctx.seller.id)
        .order('created_at', { ascending: false })

      if (input.status) {
        query = query.eq('status', input.status)
      }

      const { data, error } = await query
      if (error) throw error
      return data ?? []
    }),
})
