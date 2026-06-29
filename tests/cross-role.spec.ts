import { test, expect } from './fixtures'
import {
  seedActiveListing,
  addListingImage,
  getNotificationCount,
  getUserIdByEmail,
  dbAdmin,
} from './helpers/db'
import { trpcMutate } from './helpers/trpc'
import { e2eName } from './helpers/naming'

test('賣家發布代購 -> 許願買家收到 new_listing_for_wish 通知', async ({ sellerPage }) => {
  const buyerId = await getUserIdByEmail(process.env.E2E_BUYER_EMAIL!)
  const sellerId = await getUserIdByEmail(process.env.E2E_SELLER_EMAIL!)

  const { data: prod } = await dbAdmin()
    .from('products')
    .insert({ name: e2eName('願望商品'), category: 'other', created_by: sellerId })
    .select('id')
    .single()
  // wishes.content 為 NOT NULL,insert 必須帶 content
  await dbAdmin().from('wishes').insert({ product_id: prod!.id, user_id: buyerId, content: '[E2E] 想要' })
  const before = await getNotificationCount(buyerId, 'new_listing_for_wish')

  // Drive the real publish path (notification is created in app code, not a DB trigger).
  const draft = await trpcMutate<{ id: string }>(sellerPage.request, 'listing.create', {
    product_id: prod!.id,
    title: `[E2E] L${Date.now() % 100000}`,
    status: 'draft',
  })
  await trpcMutate(sellerPage.request, 'listing.update', {
    id: draft.id,
    price: 1500,
    is_price_on_request: false,
    shipping_date: '2026-06-30',
    post_url: 'https://www.instagram.com/p/test123/',
  })
  await trpcMutate(sellerPage.request, 'listing.publish', { id: draft.id })

  await expect
    .poll(() => getNotificationCount(buyerId, 'new_listing_for_wish'), { timeout: 15000 })
    .toBeGreaterThan(before)
})

test('管理員刪商品 -> listing product_removed + 許願取消 + 賣家通知', async ({ adminPage }) => {
  const seed = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
  const buyerId = await getUserIdByEmail(process.env.E2E_BUYER_EMAIL!)
  // 買家先許願該商品(wishes.content 為 NOT NULL)
  await dbAdmin().from('wishes').insert({ product_id: seed.productId, user_id: buyerId, content: '[E2E] 想要' })
  const notifBefore = await getNotificationCount(seed.sellerId, 'product_removed')

  await adminPage.goto('/admin/products')
  await adminPage.getByPlaceholder('搜尋商品...').fill(seed.productName)
  await adminPage.waitForTimeout(2000)
  await expect(adminPage.getByText(seed.productName).first()).toBeVisible({ timeout: 20000 })

  await adminPage.getByRole('button', { name: /移除/ }).first().click()
  await expect(adminPage.getByRole('heading', { name: '移除商品' })).toBeVisible({ timeout: 10000 })
  await adminPage.getByPlaceholder('請填寫原因...').fill('[E2E] removal')
  await adminPage.getByRole('button', { name: '確認移除' }).click()

  // listing → product_removed
  await expect
    .poll(async () => {
      const { data } = await dbAdmin().from('listings').select('inactive_reason').eq('id', seed.listingId).single()
      return data?.inactive_reason
    }, { timeout: 20000 })
    .toBe('product_removed')

  // 許願被取消
  await expect
    .poll(async () => {
      const { count } = await dbAdmin().from('wishes').select('product_id', { count: 'exact', head: true }).eq('product_id', seed.productId)
      return count ?? 0
    }, { timeout: 15000 })
    .toBe(0)

  // 賣家收 product_removed 通知
  await expect
    .poll(() => getNotificationCount(seed.sellerId, 'product_removed'), { timeout: 15000 })
    .toBeGreaterThan(notifBefore)
})

test('管理員下架 listing -> 賣家編輯頁重新上架 -> pending_approval', async ({ sellerPage }) => {
  const seed = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
  await addListingImage(seed.listingId, seed.sellerId)
  await dbAdmin()
    .from('listings')
    .update({ status: 'inactive', inactive_reason: 'admin' })
    .eq('id', seed.listingId)

  // Republish now happens from the edit page; the admin-downed listing's
  // primary submit re-sends for approval (→ pending_approval).
  await sellerPage.goto(`/dashboard/listings/${seed.listingId}/edit`)
  await sellerPage.getByRole('button', { name: '重新送出審核' }).click()

  await expect
    .poll(async () => {
      const { data } = await dbAdmin()
        .from('listings')
        .select('status')
        .eq('id', seed.listingId)
        .single()
      return data?.status
    }, { timeout: 20000 })
    .toBe('pending_approval')
})
