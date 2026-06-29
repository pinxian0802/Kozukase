import { test, expect } from '@playwright/test'
import { dbAdmin } from './helpers/db'
import { createTempUser, deleteTempUser } from './helpers/locators'

// (A) 忘記密碼頁 UI:輸入 email → resetPasswordForEmail → 「重設連結已寄出」
test('忘記密碼頁送出後顯示「重設連結已寄出」', async ({ page }) => {
  const email = `e2e-tmp-${crypto.randomUUID()}@kozukase.test`
  await page.goto('/forgot-password')
  await page.getByPlaceholder('your@email.com').fill(email)
  await page.getByRole('button', { name: /寄送|重設|送出|繼續/ }).click()
  await expect(page.getByText('重設連結已寄出')).toBeVisible({ timeout: 15000 })
})

// (B) 完整重設:generateLink(recovery) → /callback?type=recovery
//     → post-auth 強制導向 /reset-password → 填新密碼 → 導回 /login → 新密碼可登入
test('recovery 連結 → reset-password 設定新密碼 → 用新密碼可登入', async ({ page }) => {
  const u = await createTempUser() // 已確認帳號,可申請 recovery
  try {
    const { data, error } = await dbAdmin().auth.admin.generateLink({ type: 'recovery', email: u.email })
    if (error || !data.properties) throw new Error(`generateLink failed: ${error?.message}`)
    const tokenHash = data.properties.hashed_token

    await page.goto(`/callback?token_hash=${tokenHash}&type=recovery&next=/`)
    await expect(page).toHaveURL(/reset-password/, { timeout: 20000 })

    const newPw = `E2ePw!${Date.now()}`
    await page.getByLabel('新密碼').fill(newPw)
    await page.getByLabel('確認密碼').fill(newPw)
    await page.getByRole('button', { name: /更新|送出|完成|重設/ }).click()

    // 成功後 router.replace('/login')
    await expect(page).toHaveURL(/login/, { timeout: 20000 })

    // 驗證新密碼真的生效:用新密碼登入,應離開 login 頁
    // 注意:login email placeholder = 'your@email.com';送出鈕「登入」需 exact
    //(否則會撞到「使用 Google 登入」)。
    await page.getByPlaceholder('your@email.com').fill(u.email)
    await page.getByLabel('密碼').fill(newPw)
    await page.getByRole('button', { name: '登入', exact: true }).click()
    await expect(page).not.toHaveURL(/login/, { timeout: 20000 })
  } finally {
    await deleteTempUser(u.id)
  }
})

// (C) 無有效 recovery session 直接開 reset-password → 導回 login
test('無 recovery session 直接開 reset-password 會導回登入', async ({ page }) => {
  await page.goto('/reset-password')
  await expect(page).toHaveURL(/login/, { timeout: 15000 })
})
