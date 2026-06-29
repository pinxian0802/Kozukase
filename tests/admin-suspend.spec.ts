import { test, expect } from './fixtures'
import { seedActiveListing, seedActiveConnection, getNotificationCount, getUserIdByEmail, dbAdmin } from './helpers/db'
import { adminRow } from './helpers/locators'

test('停權賣家:代購下架 + 連線結束 + 通知', async ({ adminPage }) => {
  const sellerEmail = process.env.E2E_SELLER_EMAIL!
  const sellerId = await getUserIdByEmail(sellerEmail)
  const listing = await seedActiveListing(sellerEmail)
  const connection = await seedActiveConnection(sellerEmail)
  const before = await getNotificationCount(sellerId, 'account_action_taken')
  // 取賣家名稱以便在後台搜尋出該列
  const { data: sellerRow } = await dbAdmin().from('sellers').select('name').eq('id', sellerId).single()

  try {
    await adminPage.goto('/admin/sellers')
    // 先搜尋,確保該 seller 列被渲染(列表預設可能不含全部)
    await adminPage.getByPlaceholder('搜尋賣家...').fill(sellerRow!.name)
    await expect(adminRow(adminPage, sellerId)).toBeVisible({ timeout: 20000 })

    // 點該列「停權」→ 填原因 → 確認停權
    await adminRow(adminPage, sellerId).getByRole('button', { name: '停權' }).click()
    await expect(adminPage.getByRole('dialog')).toBeVisible({ timeout: 10000 })
    await adminPage.getByPlaceholder('請填寫原因...').fill('[E2E] 違規測試')
    await adminPage.getByRole('button', { name: '確認停權' }).click()

    // listing → inactive/admin
    await expect
      .poll(async () => {
        const { data } = await dbAdmin().from('listings').select('status, inactive_reason').eq('id', listing.listingId).single()
        return `${data?.status}/${data?.inactive_reason}`
      }, { timeout: 20000 })
      .toBe('inactive/admin')

    // connection → ended/admin
    await expect
      .poll(async () => {
        const { data } = await dbAdmin().from('connections').select('status, ended_reason').eq('id', connection.connectionId).single()
        return `${data?.status}/${data?.ended_reason}`
      }, { timeout: 20000 })
      .toBe('ended/admin')

    // 通知 +1
    await expect.poll(() => getNotificationCount(sellerId, 'account_action_taken'), { timeout: 15000 }).toBeGreaterThan(before)

    // sellers.is_suspended = true
    const { data: s } = await dbAdmin().from('sellers').select('is_suspended').eq('id', sellerId).single()
    expect(s?.is_suspended).toBe(true)
  } finally {
    // 還原:解除停權 + 清 seed(cleanup.ts 也會兜底)
    await dbAdmin().from('sellers').update({ is_suspended: false }).eq('id', sellerId)
    await dbAdmin().from('listings').delete().eq('id', listing.listingId)
    await dbAdmin().from('products').delete().eq('id', listing.productId)
    await dbAdmin().from('connections').delete().eq('id', connection.connectionId)
    await dbAdmin().from('notifications').delete().eq('recipient_id', sellerId).eq('type', 'account_action_taken')
  }
})
