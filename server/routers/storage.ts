import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { router, adminProcedure } from '../trpc'
import { listAllR2Objects, deleteR2Objects } from '@/lib/r2'
import { findOrphans, r2UrlToKey, type Orphan } from '@/server/lib/orphan-images'

const PAGE = 1000

/** 分頁撈某表某些欄位的所有列(避免 Supabase 預設 1000 列上限漏資料)。 */
async function selectAllRows<T extends Record<string, unknown>>(
  db: SupabaseClient,
  table: string,
  columns: string,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from(table)
      .select(columns)
      .range(from, from + PAGE - 1)
    if (error) throw error
    const batch = (data ?? []) as unknown as T[]
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return rows
}

/** 撈齊資料庫所有「有被引用」的 R2 key。 */
async function collectReferencedKeys(db: SupabaseClient): Promise<Set<string>> {
  const base = process.env.R2_PUBLIC_URL
  const keys = new Set<string>()
  const add = (k: string | null | undefined) => { if (k) keys.add(k) }
  const addUrl = (u: string | null | undefined) => { add(r2UrlToKey(u, base)) }

  // 直接是 key 的三張圖片表
  for (const table of ['product_images', 'listing_images', 'connection_images']) {
    const rows = await selectAllRows<{ r2_key: string | null; thumbnail_r2_key: string | null }>(
      db, table, 'r2_key, thumbnail_r2_key',
    )
    for (const r of rows) { add(r.r2_key); add(r.thumbnail_r2_key) }
  }

  // 橫幅(表名為 home_banners)
  const banners = await selectAllRows<{ image_r2_key: string | null }>(
    db, 'home_banners', 'image_r2_key',
  )
  for (const b of banners) add(b.image_r2_key)

  // 以網址記錄的:大頭貼(profiles / sellers)
  for (const table of ['profiles', 'sellers']) {
    const rows = await selectAllRows<{ avatar_url: string | null }>(db, table, 'avatar_url')
    for (const r of rows) addUrl(r.avatar_url)
  }

  // 訊息附圖
  const messages = await selectAllRows<{ image_url: string | null; context_image_url: string | null }>(
    db, 'messages', 'image_url, context_image_url',
  )
  for (const m of messages) { addUrl(m.image_url); addUrl(m.context_image_url) }

  return keys
}

async function computeOrphans(db: SupabaseClient, minAgeHours: number): Promise<Orphan[]> {
  const [objects, referencedKeys] = await Promise.all([
    listAllR2Objects('images/'),
    collectReferencedKeys(db),
  ])
  return findOrphans({
    objects,
    referencedKeys,
    publicBase: process.env.R2_PUBLIC_URL,
    now: new Date(),
    minAgeMs: minAgeHours * 60 * 60 * 1000,
  })
}

export const storageRouter = router({
  scanOrphanImages: adminProcedure
    .input(z.object({ minAgeHours: z.number().min(0).max(8760).default(24) }))
    .query(async ({ ctx, input }) => {
      const orphans = await computeOrphans(ctx.db, input.minAgeHours)
      return {
        orphans,
        totalCount: orphans.length,
        totalBytes: orphans.reduce((sum, o) => sum + o.size, 0),
      }
    }),

  deleteOrphanImages: adminProcedure
    .input(z.object({ keys: z.array(z.string().min(1)).min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      // 重新比對,只刪「現在仍是孤兒(門檻 24h)」且在請求清單內的 key,避免競態誤刪
      const orphanKeys = new Set((await computeOrphans(ctx.db, 24)).map((o) => o.key))
      const toDelete = input.keys.filter((k) => orphanKeys.has(k))
      if (toDelete.length > 0) await deleteR2Objects(toDelete)
      return { deleted: toDelete.length }
    }),
})
