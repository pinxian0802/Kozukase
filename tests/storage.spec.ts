import { test, expect } from './fixtures'
import { putR2Object, r2ObjectExists, deleteR2Object } from './helpers/r2'
import { trpcQuery, trpcMutate } from './helpers/trpc'
import { getSellerIdByEmail, seedListing, dbAdmin } from './helpers/db'

type Orphan = { key: string; url: string; purpose: string; size: number; lastModified: string }
type ScanResult = { orphans: Orphan[]; totalCount: number; totalBytes: number }

// ─────────────────────────────────────────────────────────────────────────────
// A：後台掃描 / 刪除
// ─────────────────────────────────────────────────────────────────────────────

test('管理員掃描可找出孤兒並刪除', async ({ adminPage }) => {
  // 在 R2 塞一個沒有任何資料庫紀錄的孤兒物件
  const sellerId = await getSellerIdByEmail(process.env.E2E_SELLER_EMAIL!)
  const key = `images/listing/users/${sellerId}/e2e-orphan-${Date.now()}.webp`
  await putR2Object(key)

  try {
    // minAgeHours: 0 才能納入剛上傳的物件
    const scan = await trpcQuery<ScanResult>(adminPage.request, 'storage.scanOrphanImages', { minAgeHours: 0 })
    expect(scan.orphans.map((o) => o.key)).toContain(key)

    const del = await trpcMutate<{ deleted: number }>(adminPage.request, 'storage.deleteOrphanImages', { keys: [key] })
    expect(del.deleted).toBe(1)

    expect(await r2ObjectExists(key)).toBe(false)
  } finally {
    await deleteR2Object(key)
  }
})

test('掃描不會列出仍被資料庫引用的圖片', async ({ adminPage }) => {
  const seed = await seedListing(process.env.E2E_SELLER_EMAIL!, 'draft')
  const key = `images/listing/users/${seed.sellerId}/e2e-ref-${Date.now()}.webp`
  await putR2Object(key)
  await dbAdmin().from('listing_images').insert({
    listing_id: seed.listingId,
    r2_key: key,
    url: `${process.env.R2_PUBLIC_URL}/${key}`,
    sort_order: 0,
  })

  try {
    const scan = await trpcQuery<ScanResult>(adminPage.request, 'storage.scanOrphanImages', { minAgeHours: 0 })
    expect(scan.orphans.map((o) => o.key)).not.toContain(key)
  } finally {
    await deleteR2Object(key)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// C：源頭止血 —— 刪除代購連帶刪 R2
// ─────────────────────────────────────────────────────────────────────────────

test('刪除代購會連帶刪掉 R2 圖片', async ({ sellerPage }) => {
  const seed = await seedListing(process.env.E2E_SELLER_EMAIL!, 'draft')
  const key = `images/listing/users/${seed.sellerId}/e2e-del-${Date.now()}.webp`
  await putR2Object(key)
  await dbAdmin().from('listing_images').insert({
    listing_id: seed.listingId,
    r2_key: key,
    url: `${process.env.R2_PUBLIC_URL}/${key}`,
    sort_order: 0,
  })

  // 刪除前 R2 上確實有檔
  expect(await r2ObjectExists(key)).toBe(true)

  // 賣家刪除這筆代購(草稿可刪)
  await trpcMutate(sellerPage.request, 'listing.delete', { id: seed.listingId })

  // 源頭止血:R2 上的圖應被連帶刪掉
  await expect.poll(() => r2ObjectExists(key), { timeout: 10000 }).toBe(false)
})
