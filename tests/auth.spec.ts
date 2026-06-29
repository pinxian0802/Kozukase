import { test, expect } from '@playwright/test'

const email = process.env.E2E_BUYER_EMAIL!
const password = process.env.E2E_PASSWORD!

test.describe('認證流程（未登入）', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('Email 密碼登入成功', async ({ page }) => {
    await page.goto('/login')
    await page.locator('#email').fill(email)
    await page.locator('#password').fill(password)
    await page.getByRole('button', { name: '登入', exact: true }).click()
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 })
    expect(new URL(page.url()).pathname).not.toContain('/login')
  })

  test('錯誤密碼應停留在登入頁', async ({ page }) => {
    await page.goto('/login')
    await page.locator('#email').fill(email)
    await page.locator('#password').fill('wrong-password-123')
    await page.getByRole('button', { name: '登入', exact: true }).click()
    await page.waitForTimeout(3000)
    expect(page.url()).toContain('/login')
  })

  test('空白送出應顯示欄位錯誤', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: '登入', exact: true }).click()
    await expect(page.getByText('Email 為必填')).toBeVisible()
    await expect(page.getByText('密碼為必填')).toBeVisible()
  })

  test('未登入訪問 /favorites 應導向登入', async ({ page }) => {
    await page.goto('/favorites')
    await page.waitForURL(/\/login/, { timeout: 15000 })
    expect(page.url()).toContain('/login')
  })
})

test.describe('已登入狀態（buyer）', () => {
  test('首頁顯示使用者頭像、登入連結消失', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: '登入' })).not.toBeVisible({ timeout: 30000 })
    await expect(page.getByTestId('user-menu')).toBeVisible({ timeout: 15000 })
  })

  test('登出後登入連結重新出現', async ({ page }) => {
    await page.goto('/')
    const trigger = page.getByTestId('user-menu')
    await expect(trigger).toBeVisible({ timeout: 30000 })
    await trigger.click()
    await page.getByText('登出').first().click()
    await page.waitForTimeout(2000)
    await page.goto('/')
    await expect(page.getByRole('link', { name: '登入' })).toBeVisible({ timeout: 15000 })
  })
})
