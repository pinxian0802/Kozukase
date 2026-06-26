import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import * as Sentry from '@sentry/nextjs'
import { appRouter } from '@/server/root'
import { createTRPCContext } from '@/server/trpc'
import type { TRPCError } from '@trpc/server'

// 預期內的 tRPC 錯誤 code（流程控制 / 使用者錯誤，不送 Sentry）
const EXPECTED_TRPC_CODES = new Set([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'BAD_REQUEST',
  'CONFLICT',
  'TOO_MANY_REQUESTS',
  'PARSE_ERROR',
])

const handler = async (req: Request) => {
  let didCapture = false

  const response = await fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: createTRPCContext,
    onError({ error, path }) {
      const code = (error as TRPCError).code
      // 預期內的使用者 / 流程錯誤不記錄、不送 Sentry。
      if (code && EXPECTED_TRPC_CODES.has(code)) {
        return
      }
      // 非預期錯誤：印到 console（dev 進終端機 / production 進 Vercel function logs），並送 Sentry。
      console.error(`[tRPC] ${path ?? 'unknown'} [${code ?? 'UNKNOWN'}]`, error)
      Sentry.captureException(error, {
        tags: { trpcPath: path ?? 'unknown' },
      })
      didCapture = true
    },
  })

  // route handler 回應後 Sentry 來不及送出，需主動 flush 已捕捉的事件
  if (didCapture) {
    await Sentry.flush(2000)
  }

  return response
}

export { handler as GET, handler as POST }
