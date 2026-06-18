import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getDb } from '@/server/db/client'

// 使用者按「我已傳送」：凍結過期、直接進管理員待審清單（由後台批次掃描比對）
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const db = getDb()
  const { data, error } = await db
    .from('ig_verification_codes')
    .update({ status: 'pending', expires_at: null })
    .eq('id', id)
    .eq('seller_id', user.id)
    .eq('status', 'created')
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found or already sent' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
