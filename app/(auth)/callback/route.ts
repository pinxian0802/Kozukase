import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getDb } from '@/server/db/client'
import { buildProfilePayload } from '@/server/routers/auth'
import { getSafeNextPath } from '@/lib/supabase/auth-error'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = getSafeNextPath(searchParams.get('next'))

  const oauthError = searchParams.get('error')
  if (oauthError) {
    const description = searchParams.get('error_description')
    const params = new URLSearchParams({ error: oauthError })
    if (description) params.set('error_description', description)
    return NextResponse.redirect(`${origin}/login?${params.toString()}`)
  }

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const user = data.session?.user

      if (user) {
        const { error: profileError } = await getDb()
          .from('profiles')
          .insert(buildProfilePayload(user))

        if (profileError && profileError.code !== '23505') {
          throw profileError
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }

    const params = new URLSearchParams({ error: 'auth_failed' })
    if (error.message) params.set('error_description', error.message)
    return NextResponse.redirect(`${origin}/login?${params.toString()}`)
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed&error_description=missing_code`)
}
