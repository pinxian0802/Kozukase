import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import {
  seedActiveListing,
  seedActiveConnection,
  seedReview,
  getLatestReport,
  getNotificationCount,
  getNotificationCountAll,
  getUserIdByEmail,
  dbAdmin,
} from './helpers/db'
import { trpcMutate } from './helpers/trpc'

// ── Card locators ───────────────────────────────────────────────────────────
// Admin listing cards: `rounded-2xl border bg-white p-4` (today + 代購審核).
function adminListingCard(page: Page, text: string) {
  return page.locator('div.rounded-2xl.border.bg-white').filter({ hasText: text })
}
// Admin connection / report cards: `rounded-lg border p-4`.
function adminLgCard(page: Page, text: string) {
  return page.locator('div.rounded-lg.border').filter({ hasText: text })
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. 檢舉只進佇列，不改狀態、不通知賣家
// ─────────────────────────────────────────────────────────────────────────────
test('買家檢舉 listing → 進待審佇列，listing 照常顯示，賣家不收到通知', async ({ buyerPage }) => {
  const seed = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
  const sellerNotifBefore = await getNotificationCountAll(seed.sellerId)

  await buyerPage.goto(`/listings/${seed.listingId}`)
  // The report entry on the listing page is an icon-only Flag button.
  await buyerPage.locator('button:has(svg.lucide-flag)').first().click()
  await expect(buyerPage.getByText('檢舉內容')).toBeVisible({ timeout: 10000 })
  await buyerPage.getByPlaceholder('請描述您的檢舉原因').fill('[E2E] 價格不實，疑似詐騙')
  await buyerPage.getByRole('button', { name: '送出檢舉' }).click()
  // Dialog closes on success.
  await expect(buyerPage.getByText('檢舉內容')).toBeHidden({ timeout: 10000 })

  // Report enqueued as pending.
  await expect
    .poll(async () => (await getLatestReport('listing_id', seed.listingId))?.status, { timeout: 15000 })
    .toBe('pending')

  // Listing unchanged, seller got no notification at all.
  const { data: listing } = await dbAdmin()
    .from('listings')
    .select('status, inactive_reason')
    .eq('id', seed.listingId)
    .single()
  expect(listing?.status).toBe('active')
  expect(listing?.inactive_reason).toBeNull()
  expect(await getNotificationCountAll(seed.sellerId)).toBe(sellerNotifBefore)
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. 管理員強制下架 active listing（唯一入口：今日新增）
// ─────────────────────────────────────────────────────────────────────────────
test('管理員從「今日新增」下架 active listing → inactive/admin + 賣家收到通知', async ({ adminPage }) => {
  const seed = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
  const notifBefore = await getNotificationCount(seed.sellerId, 'listing_removed_by_admin')
  const note = `[E2E] 下架原因 ${Date.now()}`

  await adminPage.goto('/admin/today')
  await adminPage.getByRole('tab', { name: '代購' }).click()
  await adminListingCard(adminPage, seed.productName).getByRole('button', { name: '下架' }).click()
  await expect(adminPage.getByText('下架代購')).toBeVisible({ timeout: 10000 })
  await adminPage.getByPlaceholder('請填寫原因...').fill(note)
  await adminPage.getByRole('button', { name: '確認下架' }).click()

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
    .toMatchObject({ status: 'inactive', inactive_reason: 'admin', admin_note: note })

  await expect
    .poll(() => getNotificationCount(seed.sellerId, 'listing_removed_by_admin'), { timeout: 15000 })
    .toBe(notifBefore + 1)
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. 下架後重新上架要再審：reactivate → pending_approval → 管理員核准 → active
// ─────────────────────────────────────────────────────────────────────────────
test('管理員下架後賣家重新上架 → pending_approval → 管理員核准 → active + 通知', async ({ sellerPage, adminPage }) => {
  const seed = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
  await dbAdmin()
    .from('listings')
    .update({ status: 'inactive', inactive_reason: 'admin', admin_note: '[E2E] down' })
    .eq('id', seed.listingId)
  const approveNotifBefore = await getNotificationCount(seed.sellerId, 'listing_republish_approved')

  // Seller re-submits from the dashboard. The list is a responsive table
  // (desktop <table> + hidden mobile cards both in the DOM); scope to a table
  // row to avoid the duplicate-text match, then use the row's "更多操作" menu.
  await sellerPage.goto('/dashboard/listings')
  await sellerPage.getByRole('tab', { name: /已下架/ }).click()
  const row = sellerPage.getByRole('row').filter({ hasText: seed.title })
  await expect(row).toBeVisible({ timeout: 20000 })
  await row.locator('[aria-label="更多操作"]').click()
  await sellerPage.getByRole('menuitem', { name: '重新上架' }).click()

  await expect
    .poll(
      async () =>
        (await dbAdmin().from('listings').select('status').eq('id', seed.listingId).single()).data?.status,
      { timeout: 20000 },
    )
    .toBe('pending_approval')

  // Admin approves from 代購審核.
  await adminPage.goto('/admin/listings')
  await adminListingCard(adminPage, seed.productName).getByRole('button', { name: '通過' }).click()

  await expect
    .poll(
      async () =>
        (await dbAdmin().from('listings').select('status, admin_note').eq('id', seed.listingId).single()).data,
      { timeout: 20000 },
    )
    .toMatchObject({ status: 'active', admin_note: null })

  await expect
    .poll(() => getNotificationCount(seed.sellerId, 'listing_republish_approved'), { timeout: 15000 })
    .toBe(approveNotifBefore + 1)
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. 連線同理：管理員強制結束 active 連線（入口：今日新增）
// ─────────────────────────────────────────────────────────────────────────────
test('管理員從「今日新增」結束 active 連線 → ended/admin + 賣家收到通知', async ({ adminPage }) => {
  const seed = await seedActiveConnection(process.env.E2E_SELLER_EMAIL!)
  const notifBefore = await getNotificationCount(seed.sellerId, 'connection_removed_by_admin')
  const note = `[E2E] 結束原因 ${Date.now()}`

  await adminPage.goto('/admin/today')
  await adminPage.getByRole('tab', { name: '連線' }).click()
  await adminLgCard(adminPage, seed.description).getByRole('button', { name: '結束' }).click()
  await expect(adminPage.getByText('結束連線')).toBeVisible({ timeout: 10000 })
  await adminPage.getByPlaceholder('請填寫原因...').fill(note)
  await adminPage.getByRole('button', { name: '確認結束' }).click()

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
    .toMatchObject({ status: 'ended', ended_reason: 'admin', admin_note: note })

  await expect
    .poll(() => getNotificationCount(seed.sellerId, 'connection_removed_by_admin'), { timeout: 15000 })
    .toBe(notifBefore + 1)
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. 檢舉頁「下架並結案」：一個動作同時下架對象 + 通知賣家 + 結案檢舉。
// ─────────────────────────────────────────────────────────────────────────────
test('管理員在檢舉頁「下架並結案」→ listing 一次下架(admin) + 賣家通知 + 檢舉結案', async ({ buyerPage, adminPage }) => {
  const seed = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
  const reportReason = `[E2E] 違規詐騙 ${Date.now()}`
  const handleNote = `[E2E] 經查違規，下架 ${Date.now()}`
  const notifBefore = await getNotificationCount(seed.sellerId, 'listing_removed_by_admin')

  // Buyer reports.
  await trpcMutate(buyerPage.request, 'report.create', { listing_id: seed.listingId, reason: reportReason })
  expect((await getLatestReport('listing_id', seed.listingId))?.status).toBe('pending')

  // Admin handles it entirely from the reports page — one click downs + closes.
  await adminPage.goto('/admin/reports')
  await adminLgCard(adminPage, reportReason).getByRole('button', { name: '處理' }).click()
  await expect(adminPage.getByText('處理檢舉')).toBeVisible({ timeout: 10000 })
  await adminPage.getByPlaceholder('請填寫處理原因').fill(handleNote)
  await adminPage.getByRole('button', { name: '下架並結案' }).click()

  // Listing taken down with the note as reason, seller notified.
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
    .poll(() => getNotificationCount(seed.sellerId, 'listing_removed_by_admin'), { timeout: 15000 })
    .toBe(notifBefore + 1)

  // The same action closed the report.
  await expect
    .poll(async () => (await getLatestReport('listing_id', seed.listingId))?.status, { timeout: 15000 })
    .toBe('resolved')
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. 檢舉頁「忽略」：只結案，不動被檢舉的對象、不通知。
// ─────────────────────────────────────────────────────────────────────────────
test('管理員在檢舉頁「忽略」→ listing 不動、檢舉設為 dismissed、無通知', async ({ buyerPage, adminPage }) => {
  const seed = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
  const reportReason = `[E2E] 誤檢舉 ${Date.now()}`
  const notifBefore = await getNotificationCount(seed.sellerId, 'listing_removed_by_admin')

  await trpcMutate(buyerPage.request, 'report.create', { listing_id: seed.listingId, reason: reportReason })

  await adminPage.goto('/admin/reports')
  await adminLgCard(adminPage, reportReason).getByRole('button', { name: '處理' }).click()
  await expect(adminPage.getByText('處理檢舉')).toBeVisible({ timeout: 10000 })
  await adminPage.getByRole('button', { name: '忽略' }).click()

  await expect
    .poll(async () => (await getLatestReport('listing_id', seed.listingId))?.status, { timeout: 15000 })
    .toBe('dismissed')

  // Listing untouched, no takedown notification.
  const { data: listing } = await dbAdmin()
    .from('listings')
    .select('status, inactive_reason')
    .eq('id', seed.listingId)
    .single()
  expect(listing?.status).toBe('active')
  expect(listing?.inactive_reason).toBeNull()
  expect(await getNotificationCount(seed.sellerId, 'listing_removed_by_admin')).toBe(notifBefore)
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. 檢舉頁「結束並結案」對連線：一個動作結束連線 + 通知賣家 + 結案檢舉。
// ─────────────────────────────────────────────────────────────────────────────
test('管理員在檢舉頁「結束並結案」→ 連線一次結束(admin) + 賣家通知 + 檢舉結案', async ({ buyerPage, adminPage }) => {
  const seed = await seedActiveConnection(process.env.E2E_SELLER_EMAIL!)
  const reportReason = `[E2E] 連線詐騙 ${Date.now()}`
  const handleNote = `[E2E] 連線違規，結束 ${Date.now()}`
  const notifBefore = await getNotificationCount(seed.sellerId, 'connection_removed_by_admin')

  await trpcMutate(buyerPage.request, 'report.create', { connection_id: seed.connectionId, reason: reportReason })

  await adminPage.goto('/admin/reports')
  await adminLgCard(adminPage, reportReason).getByRole('button', { name: '處理' }).click()
  await expect(adminPage.getByText('處理檢舉')).toBeVisible({ timeout: 10000 })
  await adminPage.getByPlaceholder('請填寫處理原因').fill(handleNote)
  await adminPage.getByRole('button', { name: '結束並結案' }).click()

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
    .poll(() => getNotificationCount(seed.sellerId, 'connection_removed_by_admin'), { timeout: 15000 })
    .toBe(notifBefore + 1)

  await expect
    .poll(async () => (await getLatestReport('connection_id', seed.connectionId))?.status, { timeout: 15000 })
    .toBe('resolved')
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. 檢舉頁「隱藏並結案」對評價：評價被隱藏 + 結案（無通知類型）。
// ─────────────────────────────────────────────────────────────────────────────
test('管理員在檢舉頁「隱藏並結案」→ 評價被隱藏 + 檢舉結案（無通知）', async ({ buyerPage, adminPage }) => {
  const review = await seedReview(process.env.E2E_SELLER_EMAIL!, process.env.E2E_BUYER_EMAIL!)
  const reportReason = `[E2E] 惡意評價 ${Date.now()}`

  await trpcMutate(buyerPage.request, 'report.create', { review_id: review.reviewId, reason: reportReason })

  await adminPage.goto('/admin/reports')
  await adminLgCard(adminPage, reportReason).getByRole('button', { name: '處理' }).click()
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

  // reports.review_id FK-restricts the review; delete report first, then review.
  await dbAdmin().from('reports').delete().eq('review_id', review.reviewId)
  await dbAdmin().from('reviews').delete().eq('id', review.reviewId)
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. 檢舉頁「停權並結案」對賣家：帳號停權 + 通知 + 結案。（放最後，結束後還原）
// ─────────────────────────────────────────────────────────────────────────────
test('管理員在檢舉頁「停權並結案」→ 賣家被停權 + 通知 + 檢舉結案', async ({ buyerPage, adminPage }) => {
  const sellerId = await getUserIdByEmail(process.env.E2E_SELLER_EMAIL!)
  const reportReason = `[E2E] 冒充他人 ${Date.now()}`
  const notifBefore = await getNotificationCount(sellerId, 'account_action_taken')

  await trpcMutate(buyerPage.request, 'report.create', { seller_id: sellerId, reason: reportReason })

  await adminPage.goto('/admin/reports')
  await adminLgCard(adminPage, reportReason).getByRole('button', { name: '處理' }).click()
  await expect(adminPage.getByText('處理檢舉')).toBeVisible({ timeout: 10000 })
  await adminPage.getByPlaceholder('請填寫處理原因').fill('[E2E] 冒充他人，停權')
  await adminPage.getByRole('button', { name: '停權並結案' }).click()

  try {
    await expect
      .poll(
        async () => (await dbAdmin().from('sellers').select('is_suspended').eq('id', sellerId).single()).data?.is_suspended,
        { timeout: 20000 },
      )
      .toBe(true)

    await expect
      .poll(() => getNotificationCount(sellerId, 'account_action_taken'), { timeout: 15000 })
      .toBe(notifBefore + 1)

    await expect
      .poll(async () => (await getLatestReport('seller_id', sellerId))?.status, { timeout: 15000 })
      .toBe('resolved')
  } finally {
    // Always restore the shared seller account + clear its report rows.
    await dbAdmin().from('sellers').update({ is_suspended: false, suspended_at: null }).eq('id', sellerId)
    await dbAdmin().from('reports').delete().eq('seller_id', sellerId)
  }
})
