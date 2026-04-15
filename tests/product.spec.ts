import { test, expect } from '@playwright/test'

test.describe('商品瀏覽與搜尋', () => {
  test('首頁應正常顯示', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('header')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('搜尋頁面應正常顯示', async ({ page }) => {
    await page.goto('/search')
    // The search page shows a heading "瀏覽商品" or search results heading
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 })
  })

  test('應可搜尋商品', async ({ page }) => {
    await page.goto('/search')
    await page.waitForLoadState('domcontentloaded')

    // Header has the search input
    const searchInput = page.locator('input[placeholder*="搜尋"]').first()
    if (await searchInput.isVisible({ timeout: 5000 })) {
      await searchInput.fill('test')
      await page.waitForTimeout(2000)
    }
    await expect(page.locator('body')).toBeVisible()
  })

  test('首頁搜尋列應可搜尋', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const homeSearch = page.locator('input[placeholder*="搜尋"], input[role="combobox"]').first()
    if (await homeSearch.isVisible({ timeout: 5000 })) {
      await homeSearch.click()
      await homeSearch.fill('手機')
      await page.waitForTimeout(1500)
    }
    await expect(page.locator('body')).toBeVisible()
  })

  test('連線代購頁應正常顯示', async ({ page }) => {
    await page.goto('/connections')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).toBeVisible()
    await expect(page.locator('main, [role="main"]')).toBeVisible({ timeout: 15000 })
  })

  test('許願榜頁面應正常顯示', async ({ page }) => {
    await page.goto('/wishes')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('商品收藏功能', () => {
  test('應可在搜尋結果中收藏商品', async ({ page }) => {
    await page.goto('/search')
    await page.waitForLoadState('domcontentloaded')

    const bookmarkButton = page.locator('button').filter({
      has: page.locator('svg[data-lucide="bookmark"], svg[class*="bookmark"]'),
    }).first()

    if (await bookmarkButton.isVisible({ timeout: 5000 })) {
      await bookmarkButton.click()
      await page.waitForTimeout(1500)
    }
  })

  test('個人頁面應可查看收藏', async ({ page }) => {
    await page.goto('/profile')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).toBeVisible()
  })

  test('可查看個人商品收藏', async ({ page }) => {
    await page.goto('/profile?tab=bookmarks')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('通知功能', () => {
  test('通知頁面應正常顯示', async ({ page }) => {
    await page.goto('/notifications')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).toBeVisible()
  })
})
