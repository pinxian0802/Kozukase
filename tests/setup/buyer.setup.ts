import { test as setup } from '@playwright/test'

setup('authenticate buyer', async ({ page }) => {
  const email = process.env.E2E_BUYER_EMAIL!
  const password = process.env.E2E_PASSWORD!
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: '登入', exact: true }).click()
  await page.waitForURL(
    (url) => !url.pathname.includes('/login') && !url.pathname.includes('/onboarding'),
    { timeout: 30000 },
  )
  await page.context().storageState({ path: 'tests/.auth/buyer.json' })
})
