import { test, expect } from '@playwright/test'
import { dbAdmin, getUserIdByEmail } from './helpers/db'
import { deleteTempUser } from './helpers/locators'

const tmpEmail = () => `e2e-tmp-${crypto.randomUUID()}@kozukase.test`

// (A) 註冊頁 UI:輸入 email 觸發 signInWithOtp → 切到「驗證信已寄出」狀態
test('註冊頁送出 email 後顯示「驗證信已寄出」', async ({ page }) => {
  const email = tmpEmail()
  await page.goto('/register')
  await page.getByPlaceholder('your@email.com').fill(email)
  // 送出鈕 disabled 直到勾選同意條款(disabled = !agreed)
  await page.getByRole('checkbox', { name: /我已閱讀並同意/ }).check()
  // 送出鈕 exact「寄送驗證信」(避免撞「使用 Google 註冊」)
  await page.getByRole('button', { name: '寄送驗證信' }).click()
  await expect(page.getByText('驗證信已寄出')).toBeVisible({ timeout: 15000 })
  // signInWithOtp 會建立一筆未確認 auth user,清掉避免殘留
  try {
    const id = await getUserIdByEmail(email)
    await deleteTempUser(id)
  } catch { /* 未建立則略過 */ }
})

// (B) 真註冊驗證:generateLink 取 token_hash → 訪問 /callback(模擬點信連結)
//     → verifyOtp → 新用戶建立 profiles 並導向 onboarding
test('點 magic link(token_hash)後建立 profiles 並導向 onboarding', async ({ page }) => {
  const email = tmpEmail()
  const { data, error } = await dbAdmin().auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data.properties || !data.user) throw new Error(`generateLink failed: ${error?.message}`)
  const tokenHash = data.properties.hashed_token
  const userId = data.user.id
  try {
    // type=email 對齊正式信件範本(Magic Link 範本用 type=email)。
    // 若 verifyOtp 因 type 不符失敗,改 type=magiclink(同一 token 亦可驗)。
    await page.goto(`/callback?token_hash=${tokenHash}&type=email&next=/`)
    await expect(page).toHaveURL(/onboarding/, { timeout: 20000 })
    await expect
      .poll(async () => {
        const { count } = await dbAdmin().from('profiles').select('id', { count: 'exact', head: true }).eq('id', userId)
        return count ?? 0
      }, { timeout: 15000 })
      .toBe(1)
  } finally {
    await deleteTempUser(userId)
  }
})

// (C) onboarding:Magic Link 註冊者 provider=email,須一併設定密碼。
//     欄位(由原始碼確認):username Label「ID」(輸入自動轉小寫/濾非英數)、
//     「顯示名稱」、「設定密碼」/「確認密碼」(僅 email 用戶顯示)、送出鈕「開始使用」。
test('onboarding 設定 username + 密碼後寫入 profiles', async ({ page }) => {
  const email = tmpEmail()
  const { data } = await dbAdmin().auth.admin.generateLink({ type: 'magiclink', email })
  const tokenHash = data!.properties!.hashed_token
  const userId = data!.user!.id
  try {
    await page.goto(`/callback?token_hash=${tokenHash}&type=email&next=/`)
    await expect(page).toHaveURL(/onboarding/, { timeout: 20000 })

    const username = `e2e${Date.now() % 1000000}`
    await page.getByLabel('ID').fill(username)
    await page.getByLabel('顯示名稱').fill('[E2E] 測試者')
    await page.getByLabel('設定密碼').fill('E2ePw!123')
    await page.getByLabel('確認密碼').fill('E2ePw!123')
    await page.getByRole('button', { name: '開始使用' }).click()

    await expect
      .poll(async () => {
        const { data: p } = await dbAdmin().from('profiles').select('username').eq('id', userId).single()
        return p?.username
      }, { timeout: 15000 })
      .toBe(username)
  } finally {
    await deleteTempUser(userId)
  }
})

// (D) username 太短(<3 字)被擋下。輸入框會自動轉小寫並濾掉非英數,
//     故無法用大寫/符號測格式錯誤;改用長度不足(USERNAME_REGEX 要求 3-20)。
test('onboarding username 太短被擋下,profiles.username 仍為 null', async ({ page }) => {
  const email = tmpEmail()
  const { data } = await dbAdmin().auth.admin.generateLink({ type: 'magiclink', email })
  const tokenHash = data!.properties!.hashed_token
  const userId = data!.user!.id
  try {
    await page.goto(`/callback?token_hash=${tokenHash}&type=email&next=/`)
    await expect(page).toHaveURL(/onboarding/, { timeout: 20000 })

    await page.getByLabel('ID').fill('ab') // 2 字 < 3
    await page.getByLabel('顯示名稱').fill('[E2E] x')
    await page.getByLabel('設定密碼').fill('E2ePw!123')
    await page.getByLabel('確認密碼').fill('E2ePw!123')
    await page.getByRole('button', { name: '開始使用' }).click()

    await expect(page).toHaveURL(/onboarding/, { timeout: 5000 })
    const { data: p } = await dbAdmin().from('profiles').select('username').eq('id', userId).single()
    expect(p?.username ?? null).toBeNull()
  } finally {
    await deleteTempUser(userId)
  }
})
