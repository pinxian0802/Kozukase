import { test, expect } from './fixtures'
import { putR2Object, r2ObjectExists, deleteR2Object } from './helpers/r2'
import { trpcQuery, trpcMutate } from './helpers/trpc'
import { getSellerIdByEmail, seedListing, dbAdmin } from './helpers/db'

type Orphan = { key: string; url: string; purpose: string; size: number; lastModified: string }
type ScanResult = { orphans: Orphan[]; totalCount: number; totalBytes: number }

// ─────────────────────────────────────────────────────────────────────────────
// A：後台掃描 / 刪除
// ─────────────────────────────────────────────────────────────────────────────

test('管理員掃描可找出孤兒；剛上傳的孤兒受 24h 安全門檻保護不會被刪', async ({ adminPage }) => {
  // 在 R2 塞一個沒有任何資料庫紀錄的孤兒物件
  const sellerId = await getSellerIdByEmail(process.env.E2E_SELLER_EMAIL!)
  const key = `images/listing/users/${sellerId}/e2e-orphan-${Date.now()}.webp`
  await putR2Object(key)

  try {
    // minAgeHours: 0 才能納入剛上傳的物件 → scan 找得到
    const scan = await trpcQuery<ScanResult>(adminPage.request, 'storage.scanOrphanImages', { minAgeHours: 0 })
    expect(scan.orphans.map((o) => o.key)).toContain(key)

    // deleteOrphanImages 內部重新以「固定 24h 門檻」再確認(server/routers/storage.ts:95),
    // 故剛上傳(age 0)的孤兒「不會」被刪——這是防止誤刪剛上傳、可能馬上被引用之圖的安全設計。
    // (無法在 e2e 製造 >24h 的 R2 物件,故這裡驗證的是安全門檻行為,而非實際刪除路徑。)
    const del = await trpcMutate<{ deleted: number }>(adminPage.request, 'storage.deleteOrphanImages', { keys: [key] })
    expect(del.deleted).toBe(0)
    expect(await r2ObjectExists(key)).toBe(true)
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
