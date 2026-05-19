import { test, expect } from '@playwright/test'
import { seedActiveListing, dbAdmin } from './helpers/db'

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
  await page.goto(`/sellers/${seed.sellerId}`)
  const title = await page.title()
  expect(title).toContain(data.name)
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
