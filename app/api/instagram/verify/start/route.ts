import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getDb } from '@/server/db/client'

// 每位 seller 重新產碼的冷卻時間（秒），避免狂打此端點產生大量驗證碼
const RESEND_COOLDOWN_SECONDS = 60

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const igUsername: string = (body.ig_username ?? '').trim().toLowerCase()
  if (!igUsername || !/^[a-z0-9._]{1,30}$/.test(igUsername)) {
    return NextResponse.json({ error: 'Invalid Instagram username' }, { status: 400 })
  }

  const db = getDb()

  // Rate limit：距離上次產碼未滿冷卻時間則拒絕
  const { data: lastCode } = await db
    .from('ig_verification_codes')
    .select('created_at')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastCode?.created_at) {
    const elapsedSec = (Date.now() - new Date(lastCode.created_at).getTime()) / 1000
    if (elapsedSec < RESEND_COOLDOWN_SECONDS) {
      return NextResponse.json(
        { error: 'Too many requests', retry_after: Math.ceil(RESEND_COOLDOWN_SECONDS - elapsedSec) },
        { status: 429 }
      )
    }
  }

  // 清除此 seller 既有的未驗證碼
  await db
    .from('ig_verification_codes')
    .delete()
    .eq('seller_id', user.id)
    .is('verified_at', null)

  // 用 CSPRNG 產 4 位數碼（randomInt 上界不含，故 10000 → 1000~9999）
  const code = String(randomInt(1000, 10000))
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  const { data, error } = await db
    .from('ig_verification_codes')
    .insert({
      seller_id: user.id,
      ig_username: igUsername,
      code,
      expires_at: expiresAt.toISOString(),
    })
    .select('id, code, expires_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create code' }, { status: 500 })
  }

  return NextResponse.json(data)
}
