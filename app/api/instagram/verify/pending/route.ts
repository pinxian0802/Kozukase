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
    .select('id, code, expires_at')
    .eq('seller_id', user.id)
    .is('verified_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json(data ?? null)
}
