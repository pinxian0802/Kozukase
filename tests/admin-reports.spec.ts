import { test, expect } from './fixtures'
import {
  seedActiveListing,
  seedActiveConnection,
  seedReview,
  getLatestReport,
  getNotificationCount,
  getSellerIdByEmail,
  dbAdmin,
} from './helpers/db'
import { e2eName } from './helpers/naming'

function reportRow(page: import('@playwright/test').Page, text: string) {
  return page.locator('tbody tr').filter({ hasText: text })
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. 代購檢舉 → 管理員在表格看到被檢舉商品名與檢舉人 → 下架並結案
// ─────────────────────────────────────────────────────────────────────────────
test('代購檢舉：買家透過 UI 送出 → 管理員在表格處理 → 下架並結案', async ({ buyerPage, adminPage }) => {
  const seed = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
  const reason = e2eName('代購檢舉')
  const handleNote = e2eName('下架理由')
  const notifBefore = await getNotificationCount(seed.sellerId, 'listing_removed_by_admin')

  // 買家進代購詳情頁，點旗子送出檢舉
  await buyerPage.goto(`/listings/${seed.listingId}`)
  await buyerPage.locator('button:has(svg.lucide-flag)').first().click()
  await expect(buyerPage.getByText('檢舉內容')).toBeVisible({ timeout: 10000 })
  await buyerPage.getByPlaceholder('請描述您的檢舉原因').fill(reason)
  await buyerPage.getByRole('button', { name: '送出檢舉' }).click()
  await expect(buyerPage.getByText('檢舉內容')).toBeHidden({ timeout: 10000 })

  // 管理員進 /admin/reports，找到該列
  await adminPage.goto('/admin/reports')
  const row = reportRow(adminPage, reason)
  await expect(row).toBeVisible({ timeout: 15000 })
  // 「被檢舉對象」欄顯示商品名（可點擊連結）
  await expect(row.getByText(seed.productName)).toBeVisible()
  // 點處理按鈕
  await row.getByRole('button', { name: '處理' }).click()
  await expect(adminPage.getByText('處理檢舉')).toBeVisible({ timeout: 10000 })
  await adminPage.getByPlaceholder('請填寫處理原因').fill(handleNote)
  await adminPage.getByRole('button', { name: '下架並結案' }).click()

  // 驗 DB：代購下架、檢舉結案、賣家收到通知
  await expect
    .poll(
      async () => {
        const { data } = await dbAdmin()
          .from('listings')
          .select('status, inactive_reason, admin_note')
          .eq('id', seed.listingId)
          .single()
        return data
      },
      { timeout: 20000 },
    )
    .toMatchObject({ status: 'inactive', inactive_reason: 'admin', admin_note: handleNote })

  await expect
    .poll(async () => (await getLatestReport('listing_id', seed.listingId))?.status, { timeout: 15000 })
    .toBe('resolved')

  await expect
    .poll(() => getNotificationCount(seed.sellerId, 'listing_removed_by_admin'), { timeout: 15000 })
    .toBe(notifBefore + 1)
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. 連線檢舉 → 管理員在表格看到連線 title → 結束並結案
// ─────────────────────────────────────────────────────────────────────────────
test('連線檢舉：買家透過 UI 送出 → 管理員在表格處理 → 結束並結案', async ({ buyerPage, adminPage }) => {
  const seed = await seedActiveConnection(process.env.E2E_SELLER_EMAIL!)
  const reason = e2eName('連線檢舉')
  const handleNote = e2eName('結束理由')
  const notifBefore = await getNotificationCount(seed.sellerId, 'connection_removed_by_admin')

  // 買家進連線詳情頁，點旗子送出檢舉
  await buyerPage.goto(`/connections/${seed.connectionId}`)
  await buyerPage.locator('button:has(svg.lucide-flag)').first().click()
  await expect(buyerPage.getByText('檢舉內容')).toBeVisible({ timeout: 10000 })
  await buyerPage.getByPlaceholder('請描述您的檢舉原因').fill(reason)
  await buyerPage.getByRole('button', { name: '送出檢舉' }).click()
  await expect(buyerPage.getByText('檢舉內容')).toBeHidden({ timeout: 10000 })

  // 管理員進 /admin/reports，找到該列
  await adminPage.goto('/admin/reports')
  const row = reportRow(adminPage, reason)
  await expect(row).toBeVisible({ timeout: 15000 })
  // 「被檢舉對象」欄顯示連線 title（可點擊連結）
  await expect(row.getByText(seed.title)).toBeVisible()
  // 點處理
  await row.getByRole('button', { name: '處理' }).click()
  await expect(adminPage.getByText('處理檢舉')).toBeVisible({ timeout: 10000 })
  await adminPage.getByPlaceholder('請填寫處理原因').fill(handleNote)
  await adminPage.getByRole('button', { name: '結束並結案' }).click()

  // 驗 DB
  await expect
    .poll(
      async () => {
        const { data } = await dbAdmin()
          .from('connections')
          .select('status, ended_reason, admin_note')
          .eq('id', seed.connectionId)
          .single()
        return data
      },
      { timeout: 20000 },
    )
    .toMatchObject({ status: 'ended', ended_reason: 'admin', admin_note: handleNote })

  await expect
    .poll(async () => (await getLatestReport('connection_id', seed.connectionId))?.status, { timeout: 15000 })
    .toBe('resolved')

  await expect
    .poll(() => getNotificationCount(seed.sellerId, 'connection_removed_by_admin'), { timeout: 15000 })
    .toBe(notifBefore + 1)
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. 管理員忽略 → 代購不動 + 檢舉出現在「已駁回」tab
// ─────────────────────────────────────────────────────────────────────────────
test('管理員忽略代購檢舉 → listing 不動 + 出現在「已駁回」tab', async ({ buyerPage, adminPage }) => {
  const seed = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
  const reason = e2eName('忽略測試')

  // 買家送出檢舉
  await buyerPage.goto(`/listings/${seed.listingId}`)
  await buyerPage.locator('button:has(svg.lucide-flag)').first().click()
  await expect(buyerPage.getByText('檢舉內容')).toBeVisible({ timeout: 10000 })
  await buyerPage.getByPlaceholder('請描述您的檢舉原因').fill(reason)
  await buyerPage.getByRole('button', { name: '送出檢舉' }).click()
  await expect(buyerPage.getByText('檢舉內容')).toBeHidden({ timeout: 10000 })

  // 管理員忽略
  await adminPage.goto('/admin/reports')
  const row = reportRow(adminPage, reason)
  await expect(row).toBeVisible({ timeout: 15000 })
  await row.getByRole('button', { name: '處理' }).click()
  await expect(adminPage.getByText('處理檢舉')).toBeVisible({ timeout: 10000 })
  await adminPage.getByRole('button', { name: '忽略' }).click()

  // 驗 DB：listing 不動、report = dismissed
  const { data: listing } = await dbAdmin()
    .from('listings')
    .select('status, inactive_reason')
    .eq('id', seed.listingId)
    .single()
  expect(listing?.status).toBe('active')
  expect(listing?.inactive_reason).toBeNull()

  await expect
    .poll(async () => (await getLatestReport('listing_id', seed.listingId))?.status, { timeout: 15000 })
    .toBe('dismissed')

  // 驗 UI：切到「已駁回」tab，該列出現
  await adminPage.getByRole('tab', { name: '已駁回' }).click()
  await expect(reportRow(adminPage, reason)).toBeVisible({ timeout: 10000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. 賣家檢舉：買家在賣家頁點旗子 → 管理員看到賣家名 → 停權並結案
// ─────────────────────────────────────────────────────────────────────────────
test('賣家檢舉：買家透過 UI 送出 → 管理員在表格看到賣家名 → 停權並結案', async ({ buyerPage, adminPage }) => {
  const sellerId = await getSellerIdByEmail(process.env.E2E_SELLER_EMAIL!)
  const reason = e2eName('賣家檢舉')
  const handleNote = e2eName('停權理由')
  const notifBefore = await getNotificationCount(sellerId, 'account_action_taken')

  // 買家進賣家頁，點旗子送出檢舉
  // 賣家頁有桌機/手機兩個 ReportDialog,.first() 可能抓到隱藏的;用 visible 過濾
  await buyerPage.goto(`/sellers/${sellerId}`)
  await buyerPage.locator('button:has(svg.lucide-flag)').filter({ visible: true }).first().click()
  await expect(buyerPage.getByText('檢舉內容')).toBeVisible({ timeout: 10000 })
  await buyerPage.getByPlaceholder('請描述您的檢舉原因').fill(reason)
  await buyerPage.getByRole('button', { name: '送出檢舉' }).click()
  await expect(buyerPage.getByText('檢舉內容')).toBeHidden({ timeout: 10000 })

  // 管理員在表格找到該列，確認「被檢舉對象」欄顯示賣家名
  await adminPage.goto('/admin/reports')
  const row = reportRow(adminPage, reason)
  await expect(row).toBeVisible({ timeout: 15000 })
  const { data: seller } = await dbAdmin().from('sellers').select('name').eq('id', sellerId).single()
  await expect(row.getByText(seller!.name)).toBeVisible()

  // 點處理 → 停權並結案
  await row.getByRole('button', { name: '處理' }).click()
  await expect(adminPage.getByText('處理檢舉')).toBeVisible({ timeout: 10000 })
  await adminPage.getByPlaceholder('請填寫處理原因').fill(handleNote)
  await adminPage.getByRole('button', { name: '停權並結案' }).click()

  try {
    await expect
      .poll(
        async () => (await dbAdmin().from('sellers').select('is_suspended').eq('id', sellerId).single()).data?.is_suspended,
        { timeout: 20000 },
      )
      .toBe(true)

    await expect
      .poll(async () => (await getLatestReport('seller_id', sellerId))?.status, { timeout: 15000 })
      .toBe('resolved')

    await expect
      .poll(() => getNotificationCount(sellerId, 'account_action_taken'), { timeout: 15000 })
      .toBe(notifBefore + 1)
  } finally {
    // 還原賣家帳號
    await dbAdmin().from('sellers').update({ is_suspended: false, suspended_at: null }).eq('id', sellerId)
    await dbAdmin().from('reports').delete().eq('seller_id', sellerId)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. 評論檢舉（UI 發起）：管理員在賣家頁用 DropdownMenu 檢舉評論
//    → 管理員在表格點全文 Dialog → 隱藏並結案
// ─────────────────────────────────────────────────────────────────────────────
test('評論檢舉（UI 發起）：管理員在賣家頁 DropdownMenu 送出 → 表格確認 → 隱藏並結案', async ({ adminPage }) => {
  const review = await seedReview(process.env.E2E_SELLER_EMAIL!, process.env.E2E_BUYER_EMAIL!)
  const reason = e2eName('評論檢舉UI')

  // 取得評論內容（用於驗證 Dialog）
  const { data: reviewData } = await dbAdmin()
    .from('reviews')
    .select('comment')
    .eq('id', review.reviewId)
    .single()
  const comment = reviewData?.comment ?? ''

  // 管理員進賣家頁（管理員≠評論作者，可以檢舉）
  await adminPage.goto(`/sellers/${review.sellerId}`)
  await adminPage.getByRole('tab', { name: '評價' }).click()
  // 等評論卡片載入
  const moreOptsBtn = adminPage.locator('[aria-label="更多操作"]').first()
  await expect(moreOptsBtn).toBeVisible({ timeout: 15000 })
  await moreOptsBtn.click()
  // 等 dropdown 出現
  const checkItem = adminPage.locator('[data-slot="dropdown-menu-item"]').filter({ hasText: '檢舉' })
  await expect(checkItem).toBeVisible({ timeout: 5000 })
  await checkItem.click()
  await expect(adminPage.getByText('檢舉內容')).toBeVisible({ timeout: 10000 })
  await adminPage.getByPlaceholder('請描述您的檢舉原因').fill(reason)
  await adminPage.getByRole('button', { name: '送出檢舉' }).click()
  await expect(adminPage.getByText('檢舉內容')).toBeHidden({ timeout: 10000 })

  // 管理員去報表頁，找到該列
  await adminPage.goto('/admin/reports')
  const row = reportRow(adminPage, reason)
  await expect(row).toBeVisible({ timeout: 15000 })

  // 點評論文字開 Dialog 看全文
  await row.locator('td:nth-child(2) button').click()
  await expect(adminPage.getByText('評論全文')).toBeVisible({ timeout: 10000 })
  await expect(adminPage.getByRole('dialog').getByText(comment)).toBeVisible()
  await adminPage.keyboard.press('Escape')

  // 隱藏並結案
  await row.getByRole('button', { name: '處理' }).click()
  await expect(adminPage.getByText('處理檢舉')).toBeVisible({ timeout: 10000 })
  await adminPage.getByPlaceholder('請填寫處理原因').fill('[E2E] 與交易無關，隱藏')
  await adminPage.getByRole('button', { name: '隱藏並結案' }).click()

  await expect
    .poll(
      async () => (await dbAdmin().from('reviews').select('status').eq('id', review.reviewId).single()).data?.status,
      { timeout: 20000 },
    )
    .toBe('hidden')

  await expect
    .poll(async () => (await getLatestReport('review_id', review.reviewId))?.status, { timeout: 15000 })
    .toBe('resolved')
})
