import { test, expect } from './fixtures'
import { getSellerIdByEmail, getNotificationCount, dbAdmin } from './helpers/db'

// 待審列以 ig_username 文字定位(e2e 唯一),不需 data-testid。
function reqRow(page: import('@playwright/test').Page, text: string) {
  return page.locator('tbody tr').filter({ hasText: text })
}

async function resetSeller(sellerId: string) {
  await dbAdmin().from('ig_verification_codes').delete().eq('seller_id', sellerId)
  await dbAdmin().from('sellers').update({
    ig_handle: null, ig_user_id: null, ig_connected_at: null, is_social_verified: false,
  }).eq('id', sellerId)
}

test('admin 通過 IG 驗證 → 賣家 is_social_verified + 通知', async ({ adminPage }) => {
  test.slow()
  const sellerId = await getSellerIdByEmail(process.env.E2E_SELLER_EMAIL!)
  const username = `e2e_ig_${Date.now()}`
  await resetSeller(sellerId)
  const notifBefore = await getNotificationCount(sellerId, 'ig_verification_approved')

  // seed 一筆「待審(pending)」IG 驗證(預設 status 是 created,需明設 pending 才會出現在待審清單)
  await dbAdmin().from('ig_verification_codes').insert({
    seller_id: sellerId, ig_username: username, code: 'E2E1234', status: 'pending',
  })

  try {
    await adminPage.goto('/admin/social-verification') // 預設即 Instagram tab
    await reqRow(adminPage, username).getByRole('button', { name: '通過' }).click()

    // 申請 → approved
    await expect
      .poll(async () => {
        const { data } = await dbAdmin()
          .from('ig_verification_codes').select('status')
          .eq('seller_id', sellerId).eq('ig_username', username).maybeSingle()
        return data?.status
      }, { timeout: 20000 })
      .toBe('approved')

    // 賣家已驗證
    await expect
      .poll(async () => {
        const { data } = await dbAdmin().from('sellers').select('is_social_verified, ig_handle').eq('id', sellerId).single()
        return data
      }, { timeout: 15000 })
      .toMatchObject({ is_social_verified: true, ig_handle: username })

    // 通知 +1
    await expect
      .poll(() => getNotificationCount(sellerId, 'ig_verification_approved'), { timeout: 15000 })
      .toBe(notifBefore + 1)
  } finally {
    await resetSeller(sellerId)
    await dbAdmin().from('notifications').delete().eq('recipient_id', sellerId).eq('type', 'ig_verification_approved')
  }
})

// 掃描比對依賴管理員真實 IG 收件匣 + IG token,無法穩定 e2e。只驗按鈕存在可觸發。
test('IG「掃描比對」按鈕存在', async ({ adminPage }) => {
  await adminPage.goto('/admin/social-verification')
  await expect(adminPage.getByRole('button', { name: '掃描比對 Instagram 收件匣' })).toBeVisible({ timeout: 15000 })
})

test.fixme('IG 掃描比對命中自動通過(需後端可注入假收件匣)', async () => {})
