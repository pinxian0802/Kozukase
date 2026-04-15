import { cache } from 'react'
import { createSupabaseServerClient } from './server'
import { getDb } from '@/server/db/client'

export type ServerSession = {
  user: {
    id: string
    email?: string | null
    app_metadata?: Record<string, unknown>
  }
  profile: {
    id: string
    display_name: string | null
    avatar_url: string | null
    sellers: Record<string, unknown> | null
    [key: string]: unknown
  }
  isSeller: boolean
  isAdmin: boolean
} | null

/**
 * 在 Server Component 裡讀取目前登入的 session。
 * 使用 React `cache()` 包裝，在同一個請求周期內只會實際執行一次，
 * 不管被呼叫幾次（root layout、seller layout 各呼叫一次），都只打一次 DB。
 */
export const getServerSession = cache(async (): Promise<ServerSession> => {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await getDb()
    .from('profiles')
    .select('*, sellers(*)')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) return null

  return {
    user: {
      id: user.id,
      email: user.email,
      app_metadata: user.app_metadata as Record<string, unknown>,
    },
    profile: {
      ...profile,
      sellers: (profile.sellers as Record<string, unknown> | null) ?? null,
    },
    isSeller: !!profile.sellers,
    isAdmin: user.app_metadata?.role === 'admin',
  }
})
