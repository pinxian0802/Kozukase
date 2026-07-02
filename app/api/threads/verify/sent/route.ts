import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getDb } from '@/server/db/client'

// 使用者按「我已傳送」：把 created 轉 pending，正式進管理員待審清單（與 IG 一致）
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const db = getDb()
  // 防呆:碼若已過期就不讓送出(避免把死掉的碼送進審核);清掉有效期,pending 後不再過期
  const { data, error } = await db
    .from('threads_verification_requests')
    .update({ status: 'pending', expires_at: null })
    .eq('id', id)
    .eq('seller_id', user.id)
    .eq('status', 'created')
    .gt('expires_at', new Date().toISOString())
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  if (!data) return NextResponse.json({ error: '驗證碼已過期或已送出，請重新產生' }, { status: 410 })
  return NextResponse.json({ ok: true })
}
