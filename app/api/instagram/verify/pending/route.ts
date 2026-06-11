import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getDb } from '@/server/db/client'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()
  const { data } = await db
    .from('ig_verification_codes')
    .select('id, code, expires_at, status, reject_reason')
    .eq('seller_id', user.id)
    .in('status', ['created', 'sent', 'pending', 'rejected'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // created 且已過期視為無效
  if (data && data.status === 'created' && data.expires_at && new Date(data.expires_at) < new Date()) {
    return NextResponse.json(null)
  }

  return NextResponse.json(data ?? null)
}
