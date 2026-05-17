import { test, expect } from '@playwright/test'
import { seedListing, dbAdmin } from './helpers/db'

// A listing card on the management page (unique rounded-[28px] container).
function listingCard(page: import('@playwright/test').Page, title: string) {
  return page.locator('div[class*="rounded-["]').filter({ hasText: title })
}

test.describe('賣家後台', () => {
  test('側欄與快捷操作渲染', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: '賣家後台' })).toBeVisible({ timeout: 30000 })
    await expect(page.getByRole('button', { name: '新增代購' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: '新增連線' }).first()).toBeVisible()
  })

  test('Listing 管理頁分頁顯示', async ({ page }) => {
    await page.goto('/dashboard/listings')
    await expect(page.getByRole('tab', { name: /全部/ })).toBeVisible({ timeout: 30000 })
    await expect(page.getByRole('tab', { name: /上架中/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /草稿/ })).toBeVisible()
  })

  test('賣家資料頁渲染', async ({ page }) => {
    await page.goto('/dashboard/profile')
    await expect(page.getByText('賣家資料').first()).toBeVisible({ timeout: 30000 })
  })
})

test.describe('Listing 生命週期', () => {
  test.afterEach(async () => {
    await dbAdmin().from('listings').delete().like('title', '[E2E]%')
    await dbAdmin().from('products').delete().like('name', '[E2E]%')
  })

  test('草稿出現在草稿分頁並可刪除', async ({ page }) => {
    const s = await seedListing(process.env.E2E_SELLER_EMAIL!, 'draft')
    await page.goto('/dashboard/listings')
    await page.getByRole('tab', { name: /草稿/ }).click()
    await expect(page.getByText(s.title)).toBeVisible({ timeout: 20000 })

    await listingCard(page, s.title).getByRole('button', { name: '刪除' }).click()

    await expect
      .poll(async () => {
        const { count } = await dbAdmin()
          .from('listings')
          .select('id', { count: 'exact', head: true })
          .eq('id', s.listingId)
        return count ?? 0
      }, { timeout: 15000 })
      .toBe(0)
  })

  test('上架中可下架（reason=self）', async ({ page }) => {
    const s = await seedListing(process.env.E2E_SELLER_EMAIL!, 'active')
    await page.goto('/dashboard/listings')
    await page.getByRole('tab', { name: /上架中/ }).click()
    await expect(page.getByText(s.title)).toBeVisible({ timeout: 20000 })

    await listingCard(page, s.title).getByRole('button', { name: '下架' }).click()

    await expect
      .poll(async () => {
        const { data } = await dbAdmin()
          .from('listings')
          .select('status, inactive_reason')
          .eq('id', s.listingId)
          .single()
        return `${data?.status}/${data?.inactive_reason}`
      }, { timeout: 15000 })
      .toBe('inactive/self')
  })
})

test.describe('Connection', () => {
  test('新增連線頁渲染與地區選擇', async ({ page }) => {
    await page.goto('/dashboard/connections/new')
    await expect(page.getByRole('heading', { name: '新增連線公告' })).toBeVisible({ timeout: 30000 })
    await expect(page.getByRole('button', { name: '選擇開始日期' })).toBeVisible()

    await page.getByRole('button', { name: '選擇國家' }).click()
    const firstOption = page.getByRole('option').first()
    await expect(firstOption).toBeVisible({ timeout: 10000 })
    const name = (await firstOption.textContent())?.trim() ?? ''
    expect(name.length).toBeGreaterThan(0)
    await firstOption.click()
    await expect(page.getByRole('button', { name: '選擇國家' })).toHaveCount(0)
  })
})
