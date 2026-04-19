import { test, expect } from '@playwright/test'

test.describe('賣家流程', () => {
  test('設定頁面應顯示已是賣家', async ({ page }) => {
    await page.goto('/settings')

    // Wait for session to load - should show "already a seller" (setup registered us)
    const alreadySellerMsg = page.getByText('你已經是賣家了')
    await expect(alreadySellerMsg).toBeVisible({ timeout: 30000 })

    // Should have link to dashboard
    const dashboardLink = page.getByRole('link', { name: /前往賣家後台/i })
    await expect(dashboardLink).toBeVisible()
  })

  test('賣家後台首頁應顯示統計卡片', async ({ page }) => {
    await page.goto('/dashboard')

    // Wait for dashboard to load (seller layout confirms seller status first)
    await expect(page.getByText('全部 Listing')).toBeVisible({ timeout: 30000 })
    await expect(page.getByText('上架中')).toBeVisible()
    await expect(page.getByText('草稿')).toBeVisible()
    await expect(page.getByText('待審核')).toBeVisible()
  })

  test('賣家後台應有快捷操作按鈕', async ({ page }) => {
    await page.goto('/dashboard')

    // Wait for the quick action buttons to appear
    await expect(page.getByRole('link', { name: /新增 Listing/i })).toBeVisible({ timeout: 30000 })
    await expect(page.getByRole('link', { name: /新增連線/i })).toBeVisible()
  })

  test('賣家 Listing 管理頁面應正常顯示', async ({ page }) => {
    await page.goto('/dashboard/listings')

    // Wait for the tabs to appear (seller layout + listings page load)
    await expect(page.getByRole('tab', { name: /全部/i })).toBeVisible({ timeout: 30000 })
    await expect(page.getByRole('tab', { name: /上架中/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /草稿/i })).toBeVisible()
  })

  test('賣家個人資料頁面應正常顯示', async ({ page }) => {
    await page.goto('/dashboard/profile')

    // Wait for profile settings card to appear
    await expect(page.getByText('賣家資料設定')).toBeVisible({ timeout: 30000 })
  })

  test('連線日期應禁止今天以前且結束日期必須晚於開始日期', async ({ page }) => {
    await page.goto('/dashboard/connections/new')

    await expect(page.getByRole('heading', { name: '新增連線公告' })).toBeVisible({ timeout: 30000 })

    const dateLabels = await page.evaluate(() => {
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(today.getDate() - 1)

      return {
        today: today.toLocaleDateString(),
        yesterday: yesterday.toLocaleDateString(),
      }
    })

    await page.getByRole('button', { name: '選擇開始日期' }).click()
    const startCalendar = page.locator('[data-slot="calendar"]')
    await expect(startCalendar.locator(`button[data-day="${dateLabels.yesterday}"]`)).toBeDisabled()
    await startCalendar.locator(`button[data-day="${dateLabels.today}"]`).click()

    await page.getByRole('button', { name: '選擇結束日期' }).click()
    const endCalendar = page.locator('[data-slot="calendar"]')
    await expect(endCalendar.locator(`button[data-day="${dateLabels.yesterday}"]`)).toBeDisabled()
    await expect(endCalendar.locator(`button[data-day="${dateLabels.today}"]`)).toBeDisabled()
  })

  test('連線國家選擇後應顯示地區名稱而不是原始值', async ({ page }) => {
    await page.goto('/dashboard/connections/new')

    const trigger = page.getByRole('combobox').first()
    await trigger.click()

    const firstRegionItem = page.locator('[data-slot="select-item"]').first()
    const regionName = (await firstRegionItem.textContent())?.trim()

    if (!regionName) {
      throw new Error('找不到可選擇的連線國家')
    }

    await firstRegionItem.click()

    await expect(trigger).toContainText(regionName, { timeout: 30000 })
  })
})
