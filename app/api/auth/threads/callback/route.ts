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
  const origin = request.nextUrl.origin
  const profileUrl = `${origin}/dashboard/profile`

  // 用戶在 Meta 頁面取消授權
  if (error === 'access_denied') {
    return NextResponse.redirect(`${profileUrl}?error=cancelled`)
  }

  // 驗證 CSRF state
  const cookieStore = await cookies()
  const storedState = cookieStore.get('threads_oauth_state')?.value
  cookieStore.delete('threads_oauth_state')

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
    return NextResponse.redirect(`${origin}/login?next=/dashboard/profile`)
  }

  try {
    // Step 1: 用 code 換取 short-lived token
    const tokenResp = await fetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.THREADS_CLIENT_ID!,
        client_secret: process.env.THREADS_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        redirect_uri: process.env.THREADS_REDIRECT_URI!,
        code,
      }),
    })

    if (!tokenResp.ok) {
      console.error('[Threads OAuth] Short-lived token exchange failed:', await tokenResp.text())
      return NextResponse.redirect(`${profileUrl}?error=token_exchange`)
    }

    const tokenData = await tokenResp.json()
    const shortLivedToken: string = tokenData.access_token

    // Step 2: 換取 long-lived token（有效期 60 天）
    const longLivedResp = await fetch(
      `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${process.env.THREADS_CLIENT_SECRET}&access_token=${shortLivedToken}`
    )

    if (!longLivedResp.ok) {
      console.error('[Threads OAuth] Long-lived token exchange failed:', await longLivedResp.text())
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

    // Step 3: 取得帳號基本資訊
    try {
      const profileResp = await fetch(
        `https://graph.threads.net/me?fields=id,username,threads_profile_picture_url&access_token=${accessToken}`
      )
      if (profileResp.ok) {
        const profile = await profileResp.json()
        username = profile.username ?? ''
      } else {
        const errText = await profileResp.text()
        console.error('[Threads OAuth] Profile fetch failed:', profileResp.status, errText)
        fetchFailed = true
      }
    } catch {
      fetchFailed = true
      console.error('[Threads OAuth] Profile fetch failed')
    }

    // Step 3b: 嘗試取得粉絲數（需要 threads_manage_insights 權限，失敗不影響主流程）
    try {
      const followersResp = await fetch(
        `https://graph.threads.net/me/threads_insights?metric=followers_count&period=lifetime&access_token=${accessToken}`
      )
      if (followersResp.ok) {
        const data = await followersResp.json()
        const metric = data.data?.[0]?.total_value?.value
        followersCount = typeof metric === 'number' ? metric : null
      } else {
        const errText = await followersResp.text()
        console.warn('[Threads OAuth] followers_count fetch failed:', followersResp.status, errText)
      }
    } catch {
      console.warn('[Threads OAuth] followers_count fetch exception')
    }

    // Step 4: 加密儲存 token
    await db.from('social_tokens').upsert(
      {
        seller_id: user.id,
        platform: 'threads',
        access_token: encryptToken(accessToken),
        expires_at: expiresAt.toISOString(),
        last_refreshed: new Date().toISOString(),
      },
      { onConflict: 'seller_id,platform' }
    )

    // Step 5: 更新 sellers 表
    const sellerUpdate: Record<string, unknown> = {
      threads_connected_at: new Date().toISOString(),
      is_social_verified: true,
    }
    if (username) sellerUpdate.threads_handle = username
    if (followersCount !== null) sellerUpdate.threads_follower_count = followersCount

    await db.from('sellers').update(sellerUpdate).eq('id', user.id)

    if (fetchFailed) {
      return NextResponse.redirect(`${profileUrl}?error=fetch_failed`)
    }

    return NextResponse.redirect(`${profileUrl}?connected=threads`)
  } catch (err) {
    console.error('[Threads OAuth] Unexpected error:', err)
    return NextResponse.redirect(`${profileUrl}?error=token_exchange`)
  }
}
