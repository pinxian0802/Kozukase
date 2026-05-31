import { test, expect } from './fixtures'
import { seedPendingConnection, dbAdmin } from './helpers/db'

function connectionRow(page: import('@playwright/test').Page, text: string) {
  return page.locator('tbody tr').filter({ hasText: text })
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. 管理員通過連線 → connection 變 active
// ─────────────────────────────────────────────────────────────────────────────
test('管理員在連線審核表格通過連線 → connection 變 active', async ({ adminPage }) => {
  const seed = await seedPendingConnection(process.env.E2E_SELLER_EMAIL!)

  await adminPage.goto('/admin/connections')

  // 用 description 定位（connection 表格顯示 region+description）
  const row = connectionRow(adminPage, seed.description)
  await expect(row).toBeVisible({ timeout: 15000 })
  await row.getByRole('button', { name: '通過' }).click()

  await expect
    .poll(
      async () =>
        (await dbAdmin().from('connections').select('status').eq('id', seed.connectionId).single()).data?.status,
      { timeout: 20000 },
    )
    .toBe('active')

  // 驗 UI：通過後該列從待審核表格消失
  await expect(row).toBeHidden({ timeout: 10000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. 管理員駁回連線 → connection 變 ended
// ─────────────────────────────────────────────────────────────────────────────
test('管理員在連線審核表格駁回連線 → connection 變 ended', async ({ adminPage }) => {
  const seed = await seedPendingConnection(process.env.E2E_SELLER_EMAIL!)
  const rejectReason = '[E2E] 資訊不完整，請重新申請'

  await adminPage.goto('/admin/connections')

  const row = connectionRow(adminPage, seed.description)
  await expect(row).toBeVisible({ timeout: 15000 })
  await row.getByRole('button', { name: '駁回' }).click()
  await expect(adminPage.getByText('駁回連線')).toBeVisible({ timeout: 10000 })
  await adminPage.getByPlaceholder('請填寫原因...').fill(rejectReason)
  await adminPage.getByRole('button', { name: '確認駁回' }).click()

  await expect
    .poll(
      async () =>
        (await dbAdmin().from('connections').select('status').eq('id', seed.connectionId).single()).data?.status,
      { timeout: 20000 },
    )
    .toBe('ended')

  // 驗 UI：駁回後該列從待審核表格消失
  await expect(row).toBeHidden({ timeout: 10000 })
})
