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
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(50).default(15),
      category: z.string().optional(),
      brandId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // 依商品屬性（類別／品牌）篩選時，先取出符合的 product_id 再過濾許願
      let productIds: string[] | null = null
      if (input.category || input.brandId) {
        let productQuery = ctx.db.from('products').select('id')
        if (input.category) productQuery = productQuery.eq('category', input.category)
        if (input.brandId) productQuery = productQuery.eq('brand_id', input.brandId)
        const { data: products, error: productError } = await productQuery
        if (productError) throw productError
        productIds = (products ?? []).map((p) => p.id)
        if (productIds.length === 0) {
          return { items: [], total: 0, page: input.page, totalPages: 0 }
        }
      }

      let query = ctx.db
        .from('wishes')
        .select(`
          id, created_at, content,
          product:products(
            id, name, brand:brands(name), model_number,
            catalog_image:product_images!fk_catalog_image(id, url, thumbnail_url)
          ),
          profile:profiles(display_name, avatar_url)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })

      if (productIds !== null) {
        query = query.in('product_id', productIds)
      }

      const offset = (input.page - 1) * input.limit
      query = query.range(offset, offset + input.limit - 1)

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

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.db
        .from('wishes')
        .select(`
          id, created_at, content,
          product:products(
            id, name, brand:brands(name), model_number, category, wish_count,
            catalog_image:product_images!fk_catalog_image(id, url, thumbnail_url),
            product_images:product_images!product_images_product_id_fkey(id, url, thumbnail_url)
          ),
          profile:profiles(display_name, avatar_url)
        `)
        .eq('id', input.id)
        .maybeSingle()

      if (error) throw error
      return data
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
