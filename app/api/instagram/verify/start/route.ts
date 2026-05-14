import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getDb } from '@/server/db/client'

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

  // 清除此 seller 既有的未驗證碼
  await db
    .from('ig_verification_codes')
    .delete()
    .eq('seller_id', user.id)
    .is('verified_at', null)

  const code = String(Math.floor(1000 + Math.random() * 9000))
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
