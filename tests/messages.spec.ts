import { test, expect } from './fixtures'
import { getUserIdByEmail, dbAdmin } from './helpers/db'

test('買家對賣家發訊息，訊息寫入 DB 並顯示', async ({ buyerPage }) => {
  const sellerId = await getUserIdByEmail(process.env.E2E_SELLER_EMAIL!)
  await buyerPage.goto(`/messages?seller_id=${sellerId}`)
  await buyerPage.waitForLoadState('networkidle')

  const input = buyerPage.getByPlaceholder(/輸入訊息/)
  // The input only mounts after getOrCreate resolves the conversation; retry once.
  try {
    await expect(input).toBeVisible({ timeout: 20000 })
  } catch {
    await buyerPage.goto(`/messages?seller_id=${sellerId}`)
    await buyerPage.waitForLoadState('networkidle')
    await expect(input).toBeVisible({ timeout: 20000 })
  }

  const body = `[E2E] hello ${Date.now()}`
  await input.fill(body)
  await buyerPage.keyboard.press('Enter')

  await expect(buyerPage.getByText(body)).toBeVisible({ timeout: 15000 })
  await expect
    .poll(async () => {
      const { count } = await dbAdmin()
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('body', body)
      return count ?? 0
    }, { timeout: 15000 })
    .toBeGreaterThan(0)

  await dbAdmin().from('messages').delete().eq('body', body)
})

test('賣家可開啟訊息頁', async ({ sellerPage }) => {
  await sellerPage.goto('/messages')
  await expect(sellerPage.locator('main, [role="main"]')).toBeVisible({ timeout: 20000 })
})
