import 'server-only'
import { createTRPCContext } from '@/server/trpc'
import { createCallerFactory } from '@/server/trpc'
import { appRouter } from '@/server/root'

const createCaller = createCallerFactory(appRouter)

export async function createServerCaller() {
  const context = await createTRPCContext()
  return createCaller(context)
}
