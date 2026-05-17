import { test as setup, expect } from '@playwright/test'

setup('authenticate admin', async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL!
  const password = process.env.E2E_PASSWORD!
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: '使用密碼登入' }).click()
  await page.waitForURL(
    (url) => !url.pathname.includes('/login') && !url.pathname.includes('/onboarding'),
    { timeout: 30000 },
  )
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin/, { timeout: 30000 })
  await page.context().storageState({ path: 'tests/.auth/admin.json' })
})
