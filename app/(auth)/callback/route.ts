import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSafeNextPath } from '@/lib/supabase/auth-error'
import { resolvePostAuthRedirect } from '@/lib/supabase/post-auth'

function redirectAuthFailed(origin: string, message?: string | null) {
  const params = new URLSearchParams({ error: 'auth_failed' })
  if (message) params.set('error_description', message)
  return NextResponse.redirect(`${origin}/login?${params.toString()}`)
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = getSafeNextPath(searchParams.get('next'))

  const oauthError = searchParams.get('error')
  if (oauthError) {
    const description = searchParams.get('error_description')
    const params = new URLSearchParams({ error: oauthError })
    if (description) params.set('error_description', description)
    return NextResponse.redirect(`${origin}/login?${params.toString()}`)
  }

  const supabase = await createSupabaseServerClient()

  // ── Email 連結（token_hash）──
  // 不需要 code_verifier，任何瀏覽器 / 裝置開信都能成功。
  // 註冊驗證與忘記密碼的信件都走這條。
  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    })
    if (error) {
      return redirectAuthFailed(origin, error.message)
    }
    return NextResponse.redirect(
      await resolvePostAuthRedirect({ user: data.session?.user, next, type, origin })
    )
  }

  // ── Google OAuth（PKCE code）──
  // 整個流程在同一個瀏覽器內完成，PKCE 仍是正確選擇。
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return redirectAuthFailed(origin, error.message)
    }
    return NextResponse.redirect(
      await resolvePostAuthRedirect({ user: data.session?.user, next, type, origin })
    )
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed&error_description=missing_code`)
}
