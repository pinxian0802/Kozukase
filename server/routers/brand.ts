import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { productCategoryEnum } from '@/lib/validators/product'
import { normalizeSearchText } from '@/lib/utils/search'

export const brandRouter = router({
  forSearch: publicProcedure
    .input(z.object({
      query: z.string().max(200).optional(),
      category: productCategoryEnum.optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (!input.query && !input.category) {
        const { data, error } = await ctx.db
          .from('brands')
          .select('id, name')
          .order('name')
        if (error) throw error
        return data ?? []
      }

      let productIds: string[] | null = null

      if (input.query) {
        const normalized = normalizeSearchText(input.query)
        const { data: matchingIds } = await ctx.db.rpc('search_product_ids', {
          search_query: normalized,
        })
        const ids: string[] = (matchingIds ?? []).map((r: { id: string }) => r.id)
        if (ids.length === 0) return []
        productIds = ids
      }

      let productQuery = ctx.db
        .from('products')
        .select('brand:brands!inner(id, name)')
        .eq('is_removed', false)

      if (input.category) productQuery = productQuery.eq('category', input.category)
      if (productIds !== null) productQuery = productQuery.in('id', productIds)

      const { data: products } = await productQuery

      const brandMap = new Map<string, { id: string; name: string }>()
      for (const p of products ?? []) {
        const b = Array.isArray(p.brand) ? p.brand[0] : p.brand
        if (b?.id) brandMap.set(b.id, { id: b.id, name: b.name })
      }

      return Array.from(brandMap.values()).sort((a, b) => a.name.localeCompare(b.name))
    }),

  list: publicProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.db
      .from('brands')
      .select('id, name')
      .order('name')

    if (error) throw error
    return data ?? []
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const trimmedName = input.name.trim()

      const { data: existing } = await ctx.db
        .from('brands')
        .select('id, name')
        .ilike('name', trimmedName)
        .single()

      if (existing) return existing

      const { data, error } = await ctx.db
        .from('brands')
        .insert({ name: trimmedName })
        .select('id, name')
        .single()

      if (error) throw error
      return data!
    }),
})