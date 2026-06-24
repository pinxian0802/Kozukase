import type { User } from '@supabase/supabase-js'
import { getDb } from '@/server/db/client'
import { buildProfilePayload } from '@/server/routers/auth'
import { getSafeNextPath } from '@/lib/supabase/auth-error'

// 登入 / 驗證成功後的共用初始化邏輯。
// Google 的 PKCE callback 與 email 的 token_hash 驗證共用同一套，
// 避免兩條路各寫一份、日後不同步。
// 回傳「要導向的絕對網址」。
export async function resolvePostAuthRedirect(opts: {
  user: User | null | undefined
  next: string
  type: string | null
  origin: string
}): Promise<string> {
  const { user, type, origin } = opts
  const safeNext = getSafeNextPath(opts.next)

  if (!user) {
    return `${origin}${safeNext}`
  }

  const { error: profileError } = await getDb()
    .from('profiles')
    .insert(buildProfilePayload(user))

  // 23505 = 唯一鍵衝突（profiles 已存在），屬正常情形，可忽略
  if (profileError && profileError.code !== '23505') {
    const params = new URLSearchParams({ error: 'auth_failed' })
    if (profileError.message) params.set('error_description', profileError.message)
    return `${origin}/login?${params.toString()}`
  }

  getDb()
    .from('profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', user.id)
    .then(() => {})

  if (type === 'recovery') {
    return `${origin}/reset-password`
  }

  const { data: profile } = await getDb()
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  if (!profile?.username) {
    const onboardingUrl = new URL(`${origin}/onboarding`)
    if (safeNext !== '/') onboardingUrl.searchParams.set('next', safeNext)
    return onboardingUrl.toString()
  }

  return `${origin}${safeNext}`
}
