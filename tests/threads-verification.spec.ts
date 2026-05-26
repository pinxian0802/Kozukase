import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import { dbAdmin, getSellerIdByEmail, getNotificationCount } from './helpers/db'
import { trpcMutate } from './helpers/trpc'

// Admin review cards on /admin/threads-verification: `rounded-lg border p-4`.
function reqCard(page: Page, text: string) {
  return page.locator('div.rounded-lg.border').filter({ hasText: text })
}

// The Threads row inside the seller profile 社群帳號 tab (the divider row that
// mentions Threads but not Instagram).
function threadsRow(page: Page) {
  return page.locator('div.px-5.py-4').filter({ hasText: 'Threads' }).filter({ hasNot: page.getByText('Instagram') })
}

// Shared E2E seller account — start each test from a clean, unverified state.
async function resetSeller(sellerId: string) {
  await dbAdmin().from('threads_verification_requests').delete().eq('seller_id', sellerId)
  await dbAdmin()
    .from('sellers')
    .update({
      threads_handle: null, threads_connected_at: null,
      ig_handle: null, ig_user_id: null, ig_connected_at: null,
      is_social_verified: false,
    })
    .eq('id', sellerId)
}

// Drive the seller UI from the 社群帳號 tab through to the 審核中 screen.
// Returns nothing; the pending request now exists in the DB (created by the UI).
async function sellerSubmitViaUI(sellerPage: Page, username: string) {
  await sellerPage.goto('/dashboard/profile')
  await sellerPage.getByRole('tab', { name: '社群帳號' }).click()
  await threadsRow(sellerPage).getByRole('button', { name: '驗證' }).click()
  await sellerPage.getByPlaceholder('帳號名稱').fill(username)
  await sellerPage.getByRole('button', { name: '取得驗證碼' }).click()
  await sellerPage.getByRole('button', { name: '我已傳送' }).click()
  await expect(sellerPage.getByText('審核中')).toBeVisible({ timeout: 15000 })
}

test.describe('Thread 驗證人工審核（全程點 UI）', () => {
  test('賣家 UI 送出 → 管理員 UI 通過 → 賣家頁已驗證 + 審核紀錄顯示已通過', async ({ sellerPage, adminPage }) => {
    test.slow() // 全程點兩個瀏覽器分頁、多次導頁（dev 首次編譯較慢），給更長時間
    const sellerId = await getSellerIdByEmail(process.env.E2E_SELLER_EMAIL!)
    const username = `e2e_ui_${Date.now()}`
    await resetSeller(sellerId)
    const notifBefore = await getNotificationCount(sellerId, 'threads_verification_approved')

    try {
      // ── 賣家端:實際在畫面上送出 ──
      await sellerSubmitViaUI(sellerPage, username)

      // UI 真的建立了一筆 pending（不是塞的）
      await expect
        .poll(async () => {
          const { data } = await dbAdmin()
            .from('threads_verification_requests')
            .select('status')
            .eq('seller_id', sellerId)
            .eq('threads_username', username)
            .maybeSingle()
          return data?.status
        }, { timeout: 15000 })
        .toBe('pending')

      // ── 管理員端:在待審核分頁按「通過」 ──
      await adminPage.goto('/admin/threads-verification')
      await reqCard(adminPage, username).getByRole('button', { name: '通過' }).click()

      await expect
        .poll(async () => {
          const { data } = await dbAdmin()
            .from('sellers')
            .select('threads_handle, is_social_verified')
            .eq('id', sellerId)
            .single()
          return data
        }, { timeout: 20000 })
        .toMatchObject({ threads_handle: username, is_social_verified: true })

      await expect
        .poll(() => getNotificationCount(sellerId, 'threads_verification_approved'), { timeout: 15000 })
        .toBe(notifBefore + 1)

      // ── 管理員端:切到「審核紀錄」分頁,看到這筆「已通過」 ──
      await adminPage.getByRole('tab', { name: '審核紀錄' }).click()
      await expect(reqCard(adminPage, username).getByText('已通過')).toBeVisible({ timeout: 15000 })

      // ── 賣家端:重整後 Threads 那一列顯示已連結的帳號 ──
      await sellerPage.goto('/dashboard/profile')
      await sellerPage.getByRole('tab', { name: '社群帳號' }).click()
      await expect(threadsRow(sellerPage).getByText(`@${username}`)).toBeVisible({ timeout: 15000 })
    } finally {
      await resetSeller(sellerId)
    }
  })

  test('賣家 UI 送出 → 管理員 UI 退回（填原因）→ 審核紀錄顯示已退回 + 通知', async ({ sellerPage, adminPage }) => {
    test.slow() // 全程點兩個瀏覽器分頁、多次導頁（dev 首次編譯較慢），給更長時間
    const sellerId = await getSellerIdByEmail(process.env.E2E_SELLER_EMAIL!)
    const username = `e2e_ui_${Date.now()}`
    await resetSeller(sellerId)
    const notifBefore = await getNotificationCount(sellerId, 'threads_verification_rejected')
    const reason = `[E2E] 收件匣查無此碼 ${Date.now()}`

    try {
      await sellerSubmitViaUI(sellerPage, username)

      // 管理員退回（在 UI 上填原因）
      await adminPage.goto('/admin/threads-verification')
      await reqCard(adminPage, username).getByRole('button', { name: '退回' }).click()
      await expect(adminPage.getByText('退回驗證申請')).toBeVisible({ timeout: 10000 })
      await adminPage.getByPlaceholder('例如:收件匣找不到這組驗證碼…').fill(reason)
      await adminPage.getByRole('button', { name: '確認退回' }).click()

      // 申請狀態變 rejected、賣家沒被誤標已連結
      await expect
        .poll(async () => {
          const { data } = await dbAdmin()
            .from('threads_verification_requests')
            .select('status, reject_reason')
            .eq('seller_id', sellerId)
            .eq('threads_username', username)
            .maybeSingle()
          return data
        }, { timeout: 20000 })
        .toMatchObject({ status: 'rejected', reject_reason: reason })

      const { data: seller } = await dbAdmin()
        .from('sellers')
        .select('threads_connected_at')
        .eq('id', sellerId)
        .single()
      expect(seller?.threads_connected_at).toBeNull()

      await expect
        .poll(() => getNotificationCount(sellerId, 'threads_verification_rejected'), { timeout: 15000 })
        .toBe(notifBefore + 1)

      // 審核紀錄分頁顯示「已退回」
      await adminPage.getByRole('tab', { name: '審核紀錄' }).click()
      await expect(reqCard(adminPage, username).getByText('已退回')).toBeVisible({ timeout: 15000 })
    } finally {
      await resetSeller(sellerId)
    }
  })

  test('Threads 已認證後取消 IG → is_social_verified 不被誤判為 false（後端邏輯）', async ({ sellerPage }) => {
    // 這個情境沒有純 UI 的入口（IG 取消 + 重算認證屬後端邏輯），故直接設狀態再呼叫。
    const sellerId = await getSellerIdByEmail(process.env.E2E_SELLER_EMAIL!)
    try {
      await dbAdmin()
        .from('sellers')
        .update({
          threads_handle: 'e2e_th_keep',
          threads_connected_at: new Date().toISOString(),
          ig_handle: 'e2e_ig_keep',
          ig_connected_at: new Date().toISOString(),
          is_social_verified: true,
        })
        .eq('id', sellerId)

      await trpcMutate(sellerPage.request, 'seller.disconnectSocial', { platform: 'instagram' })

      await expect
        .poll(async () => {
          const { data } = await dbAdmin()
            .from('sellers')
            .select('is_social_verified, ig_connected_at, threads_connected_at')
            .eq('id', sellerId)
            .single()
          return data
        }, { timeout: 20000 })
        .toMatchObject({ is_social_verified: true, ig_connected_at: null })
    } finally {
      await resetSeller(sellerId)
    }
  })
})
