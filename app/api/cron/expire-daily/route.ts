import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'

function isAuthorizedCron(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const expected = `Bearer ${secret}`
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

  // 下架過期商品（以 timestamp 比對，與時區無關）
  const { data: expiredListings, error: listingsError } = await supabase
    .from('listings')
    .update({ status: 'inactive', inactive_reason: 'expired' })
    .eq('status', 'active')
    .lt('expires_at', new Date().toISOString())
    .select('id')

  if (listingsError) {
    return NextResponse.json({ error: listingsError.message }, { status: 500 })
  }

  // 結束過期媒合（end_date 為日期，以台灣當天日期判斷）
  const taiwanToday = new Date(Date.now() + 8 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const { data: expiredConnections, error: connectionsError } = await supabase
    .from('connections')
    .update({ status: 'ended', ended_reason: 'expired' })
    .eq('status', 'active')
    .lt('end_date', taiwanToday)
    .select('id')

  if (connectionsError) {
    return NextResponse.json({ error: connectionsError.message }, { status: 500 })
  }

  return NextResponse.json({
    listings: expiredListings?.length ?? 0,
    connections: expiredConnections?.length ?? 0,
  })
}
