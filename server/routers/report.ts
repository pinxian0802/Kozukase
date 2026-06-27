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
      // 防濫用：每位使用者每日最多送出 DAILY_REPORT_LIMIT 份檢舉
      const DAILY_REPORT_LIMIT = 20
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { count: recentCount } = await ctx.db
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('reporter_id', ctx.user.id)
        .gte('created_at', since)

      if ((recentCount ?? 0) >= DAILY_REPORT_LIMIT) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: '今日檢舉次數已達上限，請明天再試',
        })
      }

      // 去重：同一檢舉人對同一對象若已有未處理（pending）的檢舉，不重複建立
      const targetColumn =
        input.listing_id ? 'listing_id'
        : input.review_id ? 'review_id'
        : input.connection_id ? 'connection_id'
        : 'seller_id'
      const targetValue =
        input.listing_id ?? input.review_id ?? input.connection_id ?? input.seller_id!

      const { data: existing } = await ctx.db
        .from('reports')
        .select('id')
        .eq('reporter_id', ctx.user.id)
        .eq('status', 'pending')
        .eq(targetColumn, targetValue)
        .limit(1)
        .maybeSingle()

      if (existing) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '你已檢舉過此對象，我們正在處理中' })
      }

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
