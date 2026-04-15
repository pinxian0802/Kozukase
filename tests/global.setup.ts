import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const authFile = 'tests/.auth/user.json'

setup('authenticate as test user', async ({ page }) => {
  // Ensure auth directory exists
  const authDir = path.dirname(authFile)
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }

  const email = process.env.TEST_ACCOUNT ?? 'test@test.com'
  const password = process.env.TEST_PASSWORD ?? 'poiu0987'

  // Step 1: Login
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: '使用密碼登入' }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 })
  console.log('✓ Logged in successfully')

  // Step 2: Ensure test account is a seller
  await page.goto('/settings')

  // Wait for session to load
  // "你已經是賣家了" appears if already a seller
  // "開始成為賣家" button appears if not yet a seller
  const alreadySellerMsg = page.getByText('你已經是賣家了')
  const becomeSellerBtn = page.getByRole('button', { name: /開始成為賣家/i })

  await expect(alreadySellerMsg.or(becomeSellerBtn)).toBeVisible({ timeout: 30000 })

  const isSeller = await alreadySellerMsg.isVisible()

  if (!isSeller) {
    await page.locator('#sellerName').fill('測試賣家')
    await page.locator('#phone').fill('0912345678')

    // Click the styled checkbox button (Base UI renders as button, not input)
    // The native input is aria-hidden; click the visible [data-slot="checkbox"] button
    const firstRegionCheckbox = page.locator('[data-slot="checkbox"]').first()
    await firstRegionCheckbox.click()

    await becomeSellerBtn.click()
    await page.waitForURL('**/dashboard', { timeout: 20000 })
    console.log('✓ Test user registered as seller')
  } else {
    console.log('✓ Test user is already a seller')
  }

  // Save auth state
  await page.context().storageState({ path: authFile })
  console.log('✓ Auth state saved to', authFile)
})
