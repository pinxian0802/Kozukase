import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../trpc'

export const brandRouter = router({
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