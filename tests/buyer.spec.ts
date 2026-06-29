import { test, expect } from '@playwright/test'
import { seedActiveListing, getProductWishCount, getUserIdByEmail, seedReview, dbAdmin } from './helpers/db'
import { reviewItem } from './helpers/locators'
import { trpcMutate } from './helpers/trpc'

let seed: Awaited<ReturnType<typeof seedActiveListing>>

test.beforeAll(async () => {
  seed = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
})
test.afterAll(async () => {
  await dbAdmin().from('products').delete().eq('id', seed.productId)
})

test.describe('買家瀏覽與搜尋', () => {
  // 首頁改版:主視覺已改成圖片輪播(home-hero,無固定文字 heading);
  // 「熱門商品」依 product_views 排序、無瀏覽資料時不渲染,故不據以斷言。
  // 改驗穩定一定在的「商品分類」區塊 + 成為賣家 CTA 連結。
  test('首頁顯示商品分類與成為賣家 CTA', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: '商品分類' })).toBeVisible({ timeout: 15000 })
    // become-seller 連結有桌機/手機兩版,用 visible 過濾鎖定顯示的那個
    await expect(page.locator('a[href="/become-seller"]').filter({ visible: true }).first()).toBeVisible()
  })

  test('可搜尋到 seed 商品', async ({ page }) => {
    await page.goto(`/search?tab=products&q=${encodeURIComponent(seed.productName)}`)
    await page.waitForLoadState('domcontentloaded')
    // 搜尋頁桌機/手機兩套版面都會渲染商品名,.first() 可能抓到隱藏的那份;
    // 用 visible 過濾鎖定實際顯示的卡片
    await expect(page.getByText(seed.productName).filter({ visible: true }).first()).toBeVisible({ timeout: 20000 })
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

  // 許願改走 /wishes/new(商品頁已無許願鈕);驅動實際 mutation wish.create 驗 wish_count 同步
  test('許願後 wish_count +1', async ({ page }) => {
    const before = await getProductWishCount(seed.productId)
    await trpcMutate(page.request, 'wish.create', { product_id: seed.productId, content: '[E2E] 想要' })
    await expect
      .poll(async () => getProductWishCount(seed.productId), { timeout: 15000 })
      .toBe(before + 1)
  })

  test('許願達 20 上限時第 21 筆被擋', async ({ page }) => {
    const buyerId = await getUserIdByEmail(process.env.E2E_BUYER_EMAIL!)
    // 預塞 20 筆 [E2E] 商品 + 許願(wishes.content 為 NOT NULL,必帶 content)
    const prodIds: string[] = []
    for (let i = 0; i < 20; i++) {
      const { data } = await dbAdmin().from('products').insert({ name: `[E2E] 上限${i}`, category: 'other', created_by: buyerId }).select('id').single()
      prodIds.push(data!.id)
      await dbAdmin().from('wishes').insert({ product_id: data!.id, user_id: buyerId, content: '[E2E] 想要' })
    }
    try {
      // 第 21 筆透過 wish.create 應被後端上限擋下(拋錯),且 DB 不新增
      await expect(
        trpcMutate(page.request, 'wish.create', { product_id: seed.productId, content: '[E2E] 想要' })
      ).rejects.toThrow(/上限|20/)
      const { count } = await dbAdmin().from('wishes').select('product_id', { count: 'exact', head: true }).eq('product_id', seed.productId).eq('user_id', buyerId)
      expect(count ?? 0).toBe(0)
    } finally {
      await dbAdmin().from('wishes').delete().eq('user_id', buyerId).in('product_id', prodIds)
      await dbAdmin().from('products').delete().in('id', prodIds)
    }
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

  test('買家對評價按讚同步 like_count', async ({ page }) => {
    // reviewer 用 admin(非 buyer 本人):buyer 自己的評價會顯示在 composer「你的評價」區、
    // 不在可按讚的 ReviewList 裡。用別人的評價才測得到按讚。
    const r = await seedReview(process.env.E2E_SELLER_EMAIL!, process.env.E2E_ADMIN_EMAIL!)
    try {
      await page.goto(`/sellers/${seed.sellerId}`)
      await page.getByRole('tab', { name: '評價' }).click()
      // 用 review-item testid 鎖定這筆 seed 評價(避免多筆評價時抓錯);
      // 按讚鈕在 like_count=0 時文字為「讚」
      const likeBtn = reviewItem(page, r.reviewId).getByRole('button', { name: /讚/ })
      await expect(likeBtn).toBeVisible({ timeout: 20000 })
      await likeBtn.click()
      await expect
        .poll(async () => {
          const { data } = await dbAdmin().from('reviews').select('like_count').eq('id', r.reviewId).single()
          return data?.like_count ?? 0
        }, { timeout: 15000 })
        .toBeGreaterThan(0)
    } finally {
      await dbAdmin().from('review_likes').delete().eq('review_id', r.reviewId)
      await dbAdmin().from('reviews').delete().eq('id', r.reviewId)
    }
  })
})

test.describe('瀏覽記錄', () => {
  test.afterEach(async () => {
    await dbAdmin().from('product_views').delete().eq('product_id', seed.productId)
  })

  test('開啟商品頁會新增一筆 product_views', async ({ page }) => {
    await page.goto(`/products/${seed.productId}`)
    await expect(page.getByText(seed.productName).first()).toBeVisible({ timeout: 20000 })
    await expect
      .poll(async () => {
        const { count } = await dbAdmin()
          .from('product_views')
          .select('id', { count: 'exact', head: true })
          .eq('product_id', seed.productId)
        return count ?? 0
      }, { timeout: 15000 })
      .toBeGreaterThan(0)
  })
})
