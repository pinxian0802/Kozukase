import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { decodeCursor, paginateResults } from '@/lib/utils/pagination'

export const wishRouter = router({
  create: protectedProcedure
    .input(z.object({
      product_id: z.string().uuid(),
      content: z.string().min(1, '請填寫許願內容'),
    }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.db
        .from('wishes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', ctx.user.id)

      if ((count ?? 0) >= 20) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '許願數量已達上限（20 個）' })
      }

      const { error } = await ctx.db.from('wishes').insert({
        user_id: ctx.user.id,
        product_id: input.product_id,
        content: input.content,
      })
      if (error) throw error
      return { wished: true }
    }),

  delete: protectedProcedure
    .input(z.object({ product_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.db
        .from('wishes')
        .delete()
        .eq('user_id', ctx.user.id)
        .eq('product_id', input.product_id)

      if (error) throw error
      return { wished: false }
    }),

  myWishes: protectedProcedure
    .input(z.object({
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('wishes')
        .select(`
          id, created_at, content,
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

  publicFeed: publicProcedure
    .input(z.object({
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('wishes')
        .select(`
          id, created_at, content,
          product:products(
            id, name, brand:brands(name), model_number,
            catalog_image:product_images!fk_catalog_image(id, url, thumbnail_url)
          ),
          profile:profiles(display_name, avatar_url)
        `)
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

  // 保留備用（後台排行或未來功能）
  topWished: publicProcedure
    .input(z.object({
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('products')
        .select(`
          id, name, brand:brands(name), model_number, category, wish_count,
          catalog_image:product_images!fk_catalog_image(id, url, r2_key, thumbnail_url, thumbnail_r2_key),
          product_images:product_images!product_images_product_id_fkey(id, url, r2_key, thumbnail_url, thumbnail_r2_key)
        `)
        .eq('is_removed', false)
        .gt('wish_count', 0)
        .order('wish_count', { ascending: false })
        .order('id', { ascending: false })

      if (input.cursor) {
        const { id, sortValue } = decodeCursor(input.cursor)
        if (sortValue !== undefined) {
          query = query.or(
            `wish_count.lt.${sortValue},and(wish_count.eq.${sortValue},id.lt.${id})`
          )
        }
      }

      query = query.limit(input.limit + 1)
      const { data, error } = await query
      if (error) throw error
      return paginateResults(data ?? [], input.limit, (item) => item.wish_count)
    }),
})
