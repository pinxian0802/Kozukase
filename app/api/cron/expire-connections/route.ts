import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'

function isAuthorizedCron(authHeader: string | null): boolean {
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  if (!authHeader || authHeader.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('connections')
    .update({ status: 'ended', ended_reason: 'expired' })
    .eq('status', 'active')
    .lt('end_date', today)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ expired: data?.length ?? 0 })
}
