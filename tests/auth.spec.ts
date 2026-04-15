import { test, expect } from '@playwright/test'

test.describe('認證流程', () => {
  // These tests require no auth state (use fresh page)
  test.use({ storageState: { cookies: [], origins: [] } })

  test('應能使用 Email 密碼登入', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/.+/)

    await page.locator('#email').fill(process.env.TEST_ACCOUNT!)
    await page.locator('#password').fill(process.env.TEST_PASSWORD!)
    await page.getByRole('button', { name: '使用密碼登入' }).click()

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 })
    const pathname = new URL(page.url()).pathname
    expect(pathname).not.toContain('/login')
  })

  test('錯誤密碼應顯示錯誤訊息', async ({ page }) => {
    await page.goto('/login')
    await page.locator('#email').fill(process.env.TEST_ACCOUNT!)
    await page.locator('#password').fill('wrongpassword123')
    await page.getByRole('button', { name: '使用密碼登入' }).click()

    await page.waitForTimeout(3000)
    expect(page.url()).toContain('/login')
  })
})

test.describe('已登入狀態', () => {
  test('登入後首頁應顯示使用者頭像', async ({ page }) => {
    await page.goto('/')

    // Wait for session to load - login link should disappear
    const loginLink = page.getByRole('link', { name: '登入' })
    await expect(loginLink).not.toBeVisible({ timeout: 30000 })

    // Avatar dropdown trigger should be visible
    const avatarTrigger = page.locator('[data-slot="dropdown-menu-trigger"]')
    await expect(avatarTrigger).toBeVisible({ timeout: 15000 })
  })

  test('登出功能應正常運作', async ({ page }) => {
    await page.goto('/')

    // Wait for avatar trigger to appear (auth state loaded)
    const avatarTrigger = page.locator('[data-slot="dropdown-menu-trigger"]')
    await expect(avatarTrigger).toBeVisible({ timeout: 30000 })

    // Open user dropdown
    await avatarTrigger.click()

    // Click logout
    const logoutItem = page.getByText('登出').first()
    await expect(logoutItem).toBeVisible({ timeout: 10000 })
    await logoutItem.click()

    // After logout, wait for page to settle and login link to appear
    await page.waitForTimeout(2000)
    await page.goto('/')
    const loginBtn = page.getByRole('link', { name: '登入' })
    await expect(loginBtn).toBeVisible({ timeout: 15000 })
  })
})
