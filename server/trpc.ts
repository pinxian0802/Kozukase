import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getDb } from './db/client'

export async function createTRPCContext() {
  const cookieStore = await cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignored in server components
          }
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  return {
    user,
    db: getDb(),
  }
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
})

export const router = t.router
export const publicProcedure = t.procedure
export const createCallerFactory = t.createCallerFactory

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: '請先登入' })
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  })
})

export const protectedProcedure = t.procedure.use(isAuthed)

const isSeller = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: '請先登入' })
  }

  const { data: seller } = await ctx.db
    .from('sellers')
    .select('*')
    .eq('id', ctx.user.id)
    .single()

  if (!seller) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '需要賣家身份' })
  }

  if (seller.is_suspended) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '帳號已被停權' })
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      seller,
    },
  })
})

export const sellerProcedure = t.procedure.use(isSeller)

const isAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: '請先登入' })
  }

  // Check admin role in user metadata or a separate admin table
  const isAdminUser = ctx.user.app_metadata?.role === 'admin'
  
  if (!isAdminUser) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '需要管理員權限' })
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  })
})

export const adminProcedure = t.procedure.use(isAdmin)
