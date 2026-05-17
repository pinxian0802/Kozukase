import { test, expect } from './fixtures'
import {
  seedActiveListing,
  getNotificationCount,
  getUserIdByEmail,
  dbAdmin,
} from './helpers/db'
import { trpcMutate } from './helpers/trpc'
import { e2eName } from './helpers/naming'

function listingCard(page: import('@playwright/test').Page, title: string) {
  return page.locator('div[class*="rounded-["]').filter({ hasText: title })
}

test('賣家發布代購 -> 許願買家收到 new_listing_for_wish 通知', async ({ sellerPage }) => {
  const buyerId = await getUserIdByEmail(process.env.E2E_BUYER_EMAIL!)
  const sellerId = await getUserIdByEmail(process.env.E2E_SELLER_EMAIL!)

  const { data: prod } = await dbAdmin()
    .from('products')
    .insert({ name: e2eName('願望商品'), category: 'other', created_by: sellerId })
    .select('id')
    .single()
  await dbAdmin().from('wishes').insert({ product_id: prod!.id, user_id: buyerId })
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

test('管理員刪商品 -> listing 變 product_removed', async ({ adminPage }) => {
  const seed = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)

  await adminPage.goto('/admin/products')
  await adminPage.getByPlaceholder('搜尋商品...').fill(seed.productName)
  await adminPage.waitForTimeout(2000)
  await expect(adminPage.getByText(seed.productName).first()).toBeVisible({ timeout: 20000 })

  await adminPage.getByRole('button', { name: /移除/ }).first().click()
  await expect(adminPage.getByRole('heading', { name: '移除商品' })).toBeVisible({ timeout: 10000 })
  await adminPage.getByPlaceholder('請填寫原因...').fill('[E2E] removal')
  await adminPage.getByRole('button', { name: '確認移除' }).click()

  await expect
    .poll(async () => {
      const { data } = await dbAdmin()
        .from('listings')
        .select('inactive_reason')
        .eq('id', seed.listingId)
        .single()
      return data?.inactive_reason
    }, { timeout: 20000 })
    .toBe('product_removed')
})

test('管理員下架 listing -> 賣家重新上架 -> pending_approval', async ({ sellerPage }) => {
  const seed = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
  await dbAdmin()
    .from('listings')
    .update({ status: 'inactive', inactive_reason: 'admin' })
    .eq('id', seed.listingId)

  await sellerPage.goto('/dashboard/listings')
  await sellerPage.getByRole('tab', { name: /已下架/ }).click()
  await expect(sellerPage.getByText(seed.title)).toBeVisible({ timeout: 20000 })

  await listingCard(sellerPage, seed.title).getByRole('button', { name: '重新上架' }).click()

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
