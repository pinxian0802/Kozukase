import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  if (!user) {
    return NextResponse.redirect(`${appUrl}/login?next=/dashboard/profile`)
  }

  // 產生隨機 state 防 CSRF
  const state = randomBytes(16).toString('hex')

  const cookieStore = await cookies()
  cookieStore.set('threads_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600, // 10 分鐘
    path: '/',
    sameSite: 'lax',
  })

  const params = new URLSearchParams({
    client_id: process.env.THREADS_CLIENT_ID!,
    redirect_uri: process.env.THREADS_REDIRECT_URI!,
    scope: 'threads_basic',
    response_type: 'code',
    state,
  })

  return NextResponse.redirect(`https://www.threads.net/oauth/authorize?${params}`)
}
