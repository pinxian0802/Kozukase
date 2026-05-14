import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getDb } from '@/server/db/client'

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const db = getDb()
  const { data: codeRow } = await db
    .from('ig_verification_codes')
    .select('id, seller_id, ig_username, code, expires_at, verified_at')
    .eq('id', id)
    .eq('seller_id', user.id)
    .single()

  if (!codeRow) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (codeRow.verified_at) {
    return NextResponse.json({ verified: true, ig_handle: codeRow.ig_username })
  }

  if (new Date(codeRow.expires_at) < new Date()) {
    return NextResponse.json({ verified: false, expired: true })
  }

  // 主動查 IG 收件匣
  const result = await checkIgInbox(codeRow.ig_username, codeRow.code)

  if (result.found) {
    await Promise.all([
      db.from('sellers').update({
        ig_handle: codeRow.ig_username,
        ig_user_id: result.senderIgsid ?? null,
        ig_connected_at: new Date().toISOString(),
        is_social_verified: true,
      }).eq('id', user.id),

      db.from('ig_verification_codes').update({
        verified_at: new Date().toISOString(),
      }).eq('id', codeRow.id),
    ])

    return NextResponse.json({ verified: true, ig_handle: codeRow.ig_username })
  }

  return NextResponse.json({ verified: false })
}

async function checkIgInbox(
  targetUsername: string,
  code: string,
): Promise<{ found: boolean; senderIgsid?: string }> {
  const adminToken = process.env.INSTAGRAM_ADMIN_TOKEN
  const pageId = process.env.INSTAGRAM_PAGE_ID

  if (!adminToken || !pageId) return { found: false }

  // Step 1: 取得對話列表
  const convResp = await fetch(
    `https://graph.facebook.com/v22.0/${pageId}/conversations?platform=instagram&access_token=${adminToken}`
  )
  if (!convResp.ok) return { found: false }

  const convData = await convResp.json()
  const conversations: { id: string }[] = convData.data ?? []

  // Step 2: 逐一取得每個對話的訊息，找符合的
  for (const conv of conversations) {
    const msgResp = await fetch(
      `https://graph.facebook.com/v22.0/${conv.id}/messages?fields=message,from,created_time&access_token=${adminToken}`
    )
    if (!msgResp.ok) continue

    const msgData = await msgResp.json()
    const messages: {
      message?: string
      from?: { username?: string; id?: string }
      created_time?: string
    }[] = msgData.data ?? []

    const match = messages.find(
      m =>
        m.message?.trim() === code &&
        m.from?.username?.toLowerCase() === targetUsername,
    )

    if (match) {
      return { found: true, senderIgsid: match.from?.id }
    }
  }

  return { found: false }
}
