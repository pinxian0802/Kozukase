import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'

const createReportInput = z.object({
  listing_id: z.string().uuid().optional(),
  review_id: z.string().uuid().optional(),
  connection_id: z.string().uuid().optional(),
  seller_id: z.string().uuid().optional(),
  reason: z.string().min(1, '請填寫檢舉原因').max(500),
}).refine(
  (data) => {
    const fks = [data.listing_id, data.review_id, data.connection_id, data.seller_id]
    return fks.filter(Boolean).length === 1
  },
  { message: '請選擇一個檢舉對象' }
)

export const reportRouter = router({
  create: protectedProcedure
    .input(createReportInput)
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.db
        .from('reports')
        .insert({
          reporter_id: ctx.user.id,
          listing_id: input.listing_id ?? null,
          review_id: input.review_id ?? null,
          connection_id: input.connection_id ?? null,
          seller_id: input.seller_id ?? null,
          reason: input.reason,
          status: 'pending',
        })
        .select()
        .single()

      if (error) throw error
      return data
    }),
})
