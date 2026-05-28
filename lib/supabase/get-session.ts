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
    username: string | null
    display_name: string | null
    avatar_url: string | null
    sellers: Record<string, unknown> | null
    [key: string]: unknown
  }
  isSeller: boolean
  isAdmin: boolean
  needsOnboarding: boolean
} | null

/**
 * 在 Server Component 裡讀取目前登入的 session。
 * 使用 React `cache()` 包裝，在同一個請求周期內只會實際執行一次，
 * 不管被呼叫幾次（root layout、seller layout 各呼叫一次），都只打一次 DB。
 *
 * 用 getClaims() 而不是 getUser()：在本機用 Web Crypto API 驗 JWT 簽章
 * (ES256 非對稱金鑰),不打網路。安全性等同 getUser(),但每次省 100~200ms。
 */
export const getServerSession = cache(async (): Promise<ServerSession> => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims

  if (error || !claims?.sub) return null

  const { data: profile } = await getDb()
    .from('profiles')
    .select('*, sellers(*)')
    .eq('id', claims.sub)
    .maybeSingle()

  if (!profile) return null

  const appMetadata = (claims.app_metadata ?? {}) as Record<string, unknown>

  return {
    user: {
      id: claims.sub,
      email: claims.email ?? null,
      app_metadata: appMetadata,
    },
    profile: {
      ...profile,
      sellers: (profile.sellers as Record<string, unknown> | null) ?? null,
    },
    isSeller: !!profile.sellers,
    isAdmin: appMetadata.role === 'admin',
    needsOnboarding: !profile.username,
  }
})
