import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Routes that require a logged-in session.
// Seller / admin role checks are handled in the respective layouts.
const AUTH_REQUIRED_PREFIXES = [
  '/profile',
  '/settings',
  '/notifications',
  '/dashboard',
  '/admin',
  '/onboarding',
]

// Routes where incomplete onboarding users are allowed through.
const ONBOARDING_BYPASS_PREFIXES = [
  '/onboarding',
  '/login',
  '/register',
  '/callback',
  '/api',
]

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

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const requiresAuth = AUTH_REQUIRED_PREFIXES.some((p) => pathname.startsWith(p))

  if (requiresAuth && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && !ONBOARDING_BYPASS_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!request.cookies.get(ONBOARDING_COOKIE)) {
      // Use service role client to bypass RLS — the user identity was already
      // verified above via supabase.auth.getUser(), so this is safe.
      const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()
      if (!profile?.username) {
        const onboardingUrl = request.nextUrl.clone()
        onboardingUrl.pathname = '/onboarding'
        onboardingUrl.search = ''
        return NextResponse.redirect(onboardingUrl)
      }
      supabaseResponse.cookies.set(ONBOARDING_COOKIE, '1', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      })
    }
  }

  return supabaseResponse
}
