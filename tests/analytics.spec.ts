import { test, expect } from './fixtures'
import { seedActiveListing, seedActiveConnection, dbAdmin } from './helpers/db'

async function viewCount(table: string, col: string, id: string): Promise<number> {
  const { count } = await dbAdmin().from(table).select(col, { count: 'exact', head: true }).eq(col, id)
  return count ?? 0
}

test('買家開商品頁兩次只記一筆 product_views(同 session 去重)', async ({ buyerPage }) => {
  const seed = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
  try {
    await buyerPage.goto(`/products/${seed.productId}`)
    await expect(buyerPage.getByText(seed.productName).first()).toBeVisible({ timeout: 20000 })
    await expect.poll(() => viewCount('product_views', 'product_id', seed.productId), { timeout: 15000 }).toBe(1)

    // 同 session 再看一次,計數不變
    await buyerPage.goto(`/products/${seed.productId}`)
    await buyerPage.waitForTimeout(3000)
    expect(await viewCount('product_views', 'product_id', seed.productId)).toBe(1)
  } finally {
    await dbAdmin().from('product_views').delete().eq('product_id', seed.productId)
    await dbAdmin().from('products').delete().eq('id', seed.productId)
  }
})

test('開代購頁記一筆 listing_views', async ({ buyerPage }) => {
  const seed = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
  try {
    await buyerPage.goto(`/listings/${seed.listingId}`)
    await expect(buyerPage.locator('main, [role="main"]')).toBeVisible({ timeout: 20000 })
    await expect.poll(() => viewCount('listing_views', 'listing_id', seed.listingId), { timeout: 15000 }).toBeGreaterThan(0)
  } finally {
    await dbAdmin().from('listing_views').delete().eq('listing_id', seed.listingId)
    await dbAdmin().from('products').delete().eq('id', seed.productId)
  }
})

test('賣家本人開自己連線頁不記 connection_views', async ({ sellerPage }) => {
  const conn = await seedActiveConnection(process.env.E2E_SELLER_EMAIL!)
  try {
    await sellerPage.goto(`/connections/${conn.connectionId}`)
    await sellerPage.waitForTimeout(3000)
    expect(await viewCount('connection_views', 'connection_id', conn.connectionId)).toBe(0)
  } finally {
    await dbAdmin().from('connection_views').delete().eq('connection_id', conn.connectionId)
    await dbAdmin().from('connections').delete().eq('id', conn.connectionId)
  }
})
