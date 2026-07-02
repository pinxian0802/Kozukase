import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getDb } from '@/server/db/client'

// 每位 seller 重新產碼的冷卻時間（秒），避免狂打此端點
const RESEND_COOLDOWN_SECONDS = 60

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const username: string = (body.threads_username ?? '').trim().toLowerCase()
  if (!username || !/^[a-z0-9._]{1,30}$/.test(username)) {
    return NextResponse.json({ error: 'Invalid Threads username' }, { status: 400 })
  }

  const db = getDb()

  // Rate limit：距離上次產碼未滿冷卻時間則拒絕
  const { data: last } = await db
    .from('threads_verification_requests')
    .select('created_at')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (last?.created_at) {
    const elapsedSec = (Date.now() - new Date(last.created_at).getTime()) / 1000
    if (elapsedSec < RESEND_COOLDOWN_SECONDS) {
      return NextResponse.json(
        { error: 'Too many requests', retry_after: Math.ceil(RESEND_COOLDOWN_SECONDS - elapsedSec) },
        { status: 429 }
      )
    }
  }

  // 清除此 seller 既有的未結案申請（created / pending / rejected），確保名單一人最多一筆未通過
  await db
    .from('threads_verification_requests')
    .delete()
    .eq('seller_id', user.id)
    .neq('status', 'approved')

  // 用 CSPRNG 產 4 位數碼（randomInt 上界不含，故 10000 → 1000~9999）
  const code = String(randomInt(1000, 10000))
  // 與 IG 一致:產碼後 15 分鐘有效期(僅 created 階段;按我已傳送轉 pending 時清掉)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  // created：僅產碼、尚未送審；要等使用者按「我已傳送」才轉 pending 進待審名單（與 IG 一致）
  const { data, error } = await db
    .from('threads_verification_requests')
    .insert({
      seller_id: user.id,
      threads_username: username,
      code,
      status: 'created',
      expires_at: expiresAt.toISOString(),
    })
    .select('id, code, expires_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 })
  }

  return NextResponse.json(data)
}
