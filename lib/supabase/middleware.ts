import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ONBOARDING_COOKIE = 'onboarding_done'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 用 getClaims() 而不是 getUser():在本機驗 JWT 簽章(ES256 非對稱金鑰),
  // 不打網路。安全性等同 getUser(),每次跳保護頁面省 100~200ms。
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  const userId = !error ? claims?.sub : undefined

  const { pathname } = request.nextUrl

  // 沒登入 → 一律踢去 /login,登入後可回到原本想去的頁面
  if (!userId) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 已登入,但還沒完成 onboarding → 強制導去 /onboarding
  // (本身就在 /onboarding 的話不要再導,免得無限重定向)
  if (!pathname.startsWith('/onboarding')) {
    // cookie 值存 user.id,而不是 '1'。
    // 這樣同一個瀏覽器換帳號時,舊帳號的 cookie 不會被新帳號誤用。
    const cookieValue = request.cookies.get(ONBOARDING_COOKIE)?.value
    if (cookieValue !== userId) {
      // Use service role client to bypass RLS — the user identity was already
      // verified above via JWT signature check, so this is safe.
      const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single()
      if (!profile?.username) {
        const onboardingUrl = request.nextUrl.clone()
        onboardingUrl.pathname = '/onboarding'
        onboardingUrl.search = ''
        return NextResponse.redirect(onboardingUrl)
      }
      supabaseResponse.cookies.set(ONBOARDING_COOKIE, userId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      })
    }
  }

  return supabaseResponse
}
