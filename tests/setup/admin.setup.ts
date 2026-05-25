import { test as setup, expect } from '@playwright/test'

setup('authenticate admin', async ({ page }) => {
  // First authenticated hit to /admin cold-compiles the (admin) route group +
  // Header/Sidebar under webpack dev (observed 70–120s). Allow generous budget;
  // the persistent dev server stays warm for subsequent runs.
  setup.setTimeout(240000)
  const email = process.env.E2E_ADMIN_EMAIL!
  const password = process.env.E2E_PASSWORD!
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: '登入', exact: true }).click()
  await page.waitForURL(
    (url) => !url.pathname.includes('/login') && !url.pathname.includes('/onboarding'),
    { timeout: 60000 },
  )
  // waitUntil:'commit' resolves on response headers (after the dev compile),
  // avoiding ERR_ABORTED that 'load' hits while chunks stream in.
  await page.goto('/admin', { waitUntil: 'commit', timeout: 180000 })
  await expect(page).toHaveURL(/\/admin/, { timeout: 30000 })
  await page.context().storageState({ path: 'tests/.auth/admin.json' })
})
