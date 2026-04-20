import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getDb } from '@/server/db/client'
import { encryptToken } from '@/lib/utils/social-tokens'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const profileUrl = `${appUrl}/dashboard/profile`

  // 用戶在 Meta 頁面取消授權
  if (error === 'access_denied') {
    return NextResponse.redirect(`${profileUrl}?error=cancelled`)
  }

  // 驗證 CSRF state
  const cookieStore = await cookies()
  const storedState = cookieStore.get('ig_oauth_state')?.value
  cookieStore.delete('ig_oauth_state')

  if (!storedState || state !== storedState) {
    return NextResponse.redirect(`${profileUrl}?error=invalid_state`)
  }

  if (!code) {
    return NextResponse.redirect(`${profileUrl}?error=token_exchange`)
  }

  // 驗證 session
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${appUrl}/login?next=/dashboard/profile`)
  }

  try {
    // Step 1: 用 code 換取 short-lived token
    const tokenResp = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.INSTAGRAM_CLIENT_ID!,
        client_secret: process.env.INSTAGRAM_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        redirect_uri: process.env.INSTAGRAM_REDIRECT_URI!,
        code,
      }),
    })

    if (!tokenResp.ok) {
      console.error('[IG OAuth] Short-lived token exchange failed:', await tokenResp.text())
      return NextResponse.redirect(`${profileUrl}?error=token_exchange`)
    }

    const tokenData = await tokenResp.json()
    const shortLivedToken: string = tokenData.access_token

    // Step 2: 換取 long-lived token（有效期 60 天）
    const longLivedResp = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_CLIENT_SECRET}&access_token=${shortLivedToken}`
    )

    if (!longLivedResp.ok) {
      console.error('[IG OAuth] Long-lived token exchange failed:', await longLivedResp.text())
      return NextResponse.redirect(`${profileUrl}?error=token_exchange`)
    }

    const longLivedData = await longLivedResp.json()
    const accessToken: string = longLivedData.access_token
    const expiresIn: number = longLivedData.expires_in // 秒，約 5184000（60 天）
    const expiresAt = new Date(Date.now() + expiresIn * 1000)

    const db = getDb()
    let username = ''
    let followersCount: number | null = null
    let fetchFailed = false

    // Step 3: 取得帳號資訊
    try {
      const profileResp = await fetch(
        `https://graph.instagram.com/me?fields=id,username,followers_count&access_token=${accessToken}`
      )
      if (profileResp.ok) {
        const profile = await profileResp.json()
        username = profile.username ?? ''
        followersCount = profile.followers_count ?? null
      } else {
        fetchFailed = true
      }
    } catch {
      fetchFailed = true
      console.error('[IG OAuth] Profile fetch failed')
    }

    // Step 4: 加密儲存 token
    await db.from('social_tokens').upsert(
      {
        seller_id: user.id,
        platform: 'instagram',
        access_token: encryptToken(accessToken),
        expires_at: expiresAt.toISOString(),
        last_refreshed: new Date().toISOString(),
      },
      { onConflict: 'seller_id,platform' }
    )

    // Step 5: 更新 sellers 表
    const sellerUpdate: Record<string, unknown> = {
      ig_connected_at: new Date().toISOString(),
      is_social_verified: true,
    }
    if (username) sellerUpdate.ig_handle = username
    if (followersCount !== null) sellerUpdate.ig_follower_count = followersCount

    await db.from('sellers').update(sellerUpdate).eq('id', user.id)

    if (fetchFailed) {
      return NextResponse.redirect(`${profileUrl}?error=fetch_failed`)
    }

    return NextResponse.redirect(`${profileUrl}?connected=instagram`)
  } catch (err) {
    console.error('[IG OAuth] Unexpected error:', err)
    return NextResponse.redirect(`${profileUrl}?error=token_exchange`)
  }
}
