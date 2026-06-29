import { test, expect, request as pwRequest } from '@playwright/test'
import { seedActiveListing, seedActiveConnection, dbAdmin } from './helpers/db'

// 路由已實作(route.ts):status='active' 且過期者 → listing inactive/expired、
// connection ended/expired。路由要求 Authorization: Bearer CRON_SECRET(無則回 401)。
test('cron 把過期代購下架、過期連線結束', async () => {
  // CRON_SECRET 未設(本機 .env.local 沒有)就 skip,避免必然 401
  test.skip(!process.env.CRON_SECRET, 'CRON_SECRET 未設定,略過 cron 測試')

  const listing = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
  const conn = await seedActiveConnection(process.env.E2E_SELLER_EMAIL!)
  // 改成過期:listing.expires_at 設昨天;connection.end_date 設昨天(台灣日期比對)
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10)
  await dbAdmin().from('listings').update({ expires_at: yesterday }).eq('id', listing.listingId)
  await dbAdmin().from('connections').update({ end_date: yesterday }).eq('id', conn.connectionId)

  try {
    const ctx = await pwRequest.newContext()
    const res = await ctx.get('http://localhost:3000/api/cron/expire-daily', {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    })
    expect(res.ok()).toBeTruthy()
    await ctx.dispose()

    await expect
      .poll(async () => {
        const { data } = await dbAdmin().from('listings').select('status, inactive_reason').eq('id', listing.listingId).single()
        return `${data?.status}/${data?.inactive_reason}`
      }, { timeout: 15000 })
      .toBe('inactive/expired')

    await expect
      .poll(async () => {
        const { data } = await dbAdmin().from('connections').select('status, ended_reason').eq('id', conn.connectionId).single()
        return `${data?.status}/${data?.ended_reason}`
      }, { timeout: 15000 })
      .toBe('ended/expired')
  } finally {
    await dbAdmin().from('listings').delete().eq('id', listing.listingId)
    await dbAdmin().from('products').delete().eq('id', listing.productId)
    await dbAdmin().from('connections').delete().eq('id', conn.connectionId)
  }
})
