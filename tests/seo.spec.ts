import { test, expect } from '@playwright/test'
import { seedActiveListing, seedReview, dbAdmin } from './helpers/db'

let seed: Awaited<ReturnType<typeof seedActiveListing>>

test.beforeAll(async () => {
  seed = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
})

test.afterAll(async () => {
  await dbAdmin().from('products').delete().eq('id', seed.productId)
})

test('robots.txt 包含 sitemap 連結', async ({ page }) => {
  const response = await page.request.get('/robots.txt')
  expect(response.status()).toBe(200)
  const body = await response.text()
  expect(body).toContain('Sitemap: https://kozukase.com/sitemap.xml')
})

test('sitemap.xml 包含首頁 URL', async ({ page }) => {
  const response = await page.request.get('/sitemap.xml')
  expect(response.status()).toBe(200)
  const body = await response.text()
  expect(body).toContain('<loc>https://kozukase.com</loc>')
})

test('首頁有 og:title meta tag', async ({ page }) => {
  await page.goto('/')
  const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content')
  expect(ogTitle).toBeTruthy()
})

test('賣家頁 title 包含賣家名稱', async ({ page }) => {
  const { data } = await dbAdmin().from('sellers').select('name').eq('id', seed.sellerId).single()
  expect(data).not.toBeNull()
  await page.goto(`/sellers/${seed.sellerId}`)
  const title = await page.title()
  expect(title).toContain(data!.name)
})

test('商品頁 title 包含商品名稱', async ({ page }) => {
  await page.goto(`/products/${seed.productId}`)
  const title = await page.title()
  expect(title).toContain(seed.productName)
})

test('代購頁 title 包含商品名稱', async ({ page }) => {
  await page.goto(`/listings/${seed.listingId}`)
  const title = await page.title()
  expect(title).toContain(seed.productName)
})

test('搜尋頁有 canonical URL', async ({ page }) => {
  await page.goto('/search')
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
  expect(canonical).toBe('https://kozukase.com/search')
})

test('首頁有 Organization 與 WebSite 結構化資料', async ({ page }) => {
  await page.goto('/')
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
  const types = blocks.flatMap((b) => {
    const parsed = JSON.parse(b)
    return Array.isArray(parsed) ? parsed.map((d) => d['@type']) : [parsed['@type']]
  })
  expect(types).toContain('Organization')
  expect(types).toContain('WebSite')
})

test('商品頁有 Product 結構化資料與 AggregateOffer', async ({ page }) => {
  await page.goto(`/products/${seed.productId}`)
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
  const product = blocks
    .flatMap((b) => {
      const parsed = JSON.parse(b)
      return Array.isArray(parsed) ? parsed : [parsed]
    })
    .find((d) => d['@type'] === 'Product')
  expect(product).toBeTruthy()
  expect(product.offers['@type']).toBe('AggregateOffer')
  expect(product.offers.priceCurrency).toBe('TWD')
  expect(product.offers.offerCount).toBeGreaterThanOrEqual(1)
})

test('商品頁標題以 - Kozukase 結尾', async ({ page }) => {
  await page.goto(`/products/${seed.productId}`)
  expect(await page.title()).toContain('- Kozukase')
})

test('賣家頁有 Organization 結構化資料', async ({ page }) => {
  await seedReview(process.env.E2E_SELLER_EMAIL!, process.env.E2E_BUYER_EMAIL!)
  await page.goto(`/sellers/${seed.sellerId}`)
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
  const org = blocks
    .flatMap((b) => {
      const parsed = JSON.parse(b)
      return Array.isArray(parsed) ? parsed : [parsed]
    })
    .find((d) => d['@type'] === 'Organization')
  expect(org).toBeTruthy()
  expect(org.aggregateRating.reviewCount).toBeGreaterThanOrEqual(1)
})

test('賣家頁標題為「在 Kozukase 的賣場」', async ({ page }) => {
  await page.goto(`/sellers/${seed.sellerId}`)
  expect(await page.title()).toContain('在 Kozukase 的賣場')
})

test('許願列表標題正確', async ({ page }) => {
  await page.goto('/wishes')
  expect(await page.title()).toContain('代購許願列表')
})

test('連線列表標題正確', async ({ page }) => {
  await page.goto('/connections')
  expect(await page.title()).toContain('尋找心儀的代購連線')
})
