import { test, expect } from '@playwright/test'
import { seedActiveListing, getProductWishCount, dbAdmin } from './helpers/db'

let seed: Awaited<ReturnType<typeof seedActiveListing>>

test.beforeAll(async () => {
  seed = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
})
test.afterAll(async () => {
  await dbAdmin().from('products').delete().eq('id', seed.productId)
})

test.describe('買家瀏覽與搜尋', () => {
  test('首頁、搜尋、連線、許願榜頁面渲染', async ({ page }) => {
    for (const path of ['/', '/search', '/connections', '/wishes']) {
      await page.goto(path)
      await expect(page.locator('header')).toBeVisible({ timeout: 15000 })
    }
  })

  test('可搜尋到 seed 商品', async ({ page }) => {
    await page.goto(`/search?tab=products&q=${encodeURIComponent(seed.productName)}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText(seed.productName).first()).toBeVisible({ timeout: 20000 })
  })

  test('商品詳情頁渲染', async ({ page }) => {
    await page.goto(`/products/${seed.productId}`)
    await expect(page.getByText(seed.productName).first()).toBeVisible({ timeout: 20000 })
  })

  test('代購詳情頁渲染', async ({ page }) => {
    await page.goto(`/listings/${seed.listingId}`)
    await expect(page.locator('main, [role="main"]')).toBeVisible({ timeout: 20000 })
  })
})

test.describe('許願與計數同步', () => {
  test.afterEach(async () => {
    await dbAdmin().from('wishes').delete().eq('product_id', seed.productId)
  })

  test('在商品詳情頁許願後 wish_count +1', async ({ page }) => {
    const before = await getProductWishCount(seed.productId)
    await page.goto(`/products/${seed.productId}`)
    const wishBtn = page.getByRole('button', { name: /許願/ }).first()
    await expect(wishBtn).toBeVisible({ timeout: 20000 })
    await wishBtn.click()
    await expect
      .poll(async () => getProductWishCount(seed.productId), { timeout: 15000 })
      .toBe(before + 1)
  })
})

test.describe('收藏與追蹤', () => {
  test.afterEach(async () => {
    await dbAdmin().from('product_bookmarks').delete().eq('product_id', seed.productId)
    await dbAdmin().from('follows').delete().eq('seller_id', seed.sellerId)
  })

  test('商品詳情頁可收藏', async ({ page }) => {
    await page.goto(`/products/${seed.productId}`)
    const bm = page.getByRole('button', { name: /收藏/ }).first()
    await expect(bm).toBeVisible({ timeout: 20000 })
    await bm.click()
    await expect
      .poll(async () => {
        const { count } = await dbAdmin()
          .from('product_bookmarks')
          .select('id', { count: 'exact', head: true })
          .eq('product_id', seed.productId)
        return count ?? 0
      }, { timeout: 15000 })
      .toBeGreaterThan(0)
  })

  test('賣家頁可追蹤、follows 同步', async ({ page }) => {
    await page.goto(`/sellers/${seed.sellerId}`)
    const followBtn = page.getByRole('button', { name: /追蹤賣家/ }).first()
    await expect(followBtn).toBeVisible({ timeout: 20000 })
    await followBtn.click()
    await expect
      .poll(async () => {
        const { count } = await dbAdmin()
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('seller_id', seed.sellerId)
        return count ?? 0
      }, { timeout: 15000 })
      .toBeGreaterThan(0)
  })
})

test.describe('評價', () => {
  test.afterEach(async () => {
    await dbAdmin().from('reviews').delete().eq('seller_id', seed.sellerId)
  })

  test('可對賣家留 5 星評價，review_count 同步', async ({ page }) => {
    await page.goto(`/sellers/${seed.sellerId}`)
    await page.getByRole('tab', { name: '評價' }).click()
    const reviewForm = page.locator('form').filter({ hasText: '送出評價' })
    await expect(reviewForm).toBeVisible({ timeout: 20000 })
    await reviewForm.locator('button[type="button"]').nth(4).click()
    await reviewForm.getByRole('button', { name: /送出評價/ }).click()
    await expect
      .poll(async () => {
        const { count } = await dbAdmin()
          .from('reviews')
          .select('id', { count: 'exact', head: true })
          .eq('seller_id', seed.sellerId)
        return count ?? 0
      }, { timeout: 15000 })
      .toBeGreaterThan(0)
  })
})
