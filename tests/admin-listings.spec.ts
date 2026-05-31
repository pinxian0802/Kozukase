import { test, expect } from './fixtures'
import { seedPendingListing, dbAdmin } from './helpers/db'

function listingRow(page: import('@playwright/test').Page, text: string) {
  return page.locator('tbody tr').filter({ hasText: text })
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. 管理員通過代購 → listing 變 active
// ─────────────────────────────────────────────────────────────────────────────
test('管理員在代購審核表格通過代購 → listing 變 active', async ({ adminPage }) => {
  const seed = await seedPendingListing(process.env.E2E_SELLER_EMAIL!)

  await adminPage.goto('/admin/listings')

  const row = listingRow(adminPage, seed.productName)
  await expect(row).toBeVisible({ timeout: 15000 })
  await row.getByRole('button', { name: '通過' }).click()

  await expect
    .poll(
      async () =>
        (await dbAdmin().from('listings').select('status').eq('id', seed.listingId).single()).data?.status,
      { timeout: 20000 },
    )
    .toBe('active')

  // 驗 UI：通過後該列從待審核表格消失
  await expect(row).toBeHidden({ timeout: 10000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. 管理員駁回代購 → listing 變 inactive
// ─────────────────────────────────────────────────────────────────────────────
test('管理員在代購審核表格駁回代購 → listing 變 inactive', async ({ adminPage }) => {
  const seed = await seedPendingListing(process.env.E2E_SELLER_EMAIL!)
  const rejectReason = '[E2E] 缺乏必要資訊'

  await adminPage.goto('/admin/listings')

  const row = listingRow(adminPage, seed.productName)
  await expect(row).toBeVisible({ timeout: 15000 })
  await row.getByRole('button', { name: '駁回' }).click()
  await expect(adminPage.getByText('駁回代購')).toBeVisible({ timeout: 10000 })
  await adminPage.getByPlaceholder('請填寫原因...').fill(rejectReason)
  await adminPage.getByRole('button', { name: '確認駁回' }).click()

  await expect
    .poll(
      async () => {
        const { data } = await dbAdmin()
          .from('listings')
          .select('status, inactive_reason')
          .eq('id', seed.listingId)
          .single()
        return data
      },
      { timeout: 20000 },
    )
    .toMatchObject({ status: 'inactive', inactive_reason: 'admin' })

  // 驗 UI：駁回後該列從待審核表格消失
  await expect(row).toBeHidden({ timeout: 10000 })
})
