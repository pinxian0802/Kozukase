# 清除孤兒圖片功能 實作計畫

> **給執行者：** 本計畫依使用者要求**不寫自動化測試**,改以型別檢查、lint 與後台手動操作驗證。每個任務最後的 commit **一律等使用者明確同意才執行**(使用者要求不主動 commit);未同意時只 stage 後停下來等指示。

**目標：** 在管理後台新增「孤兒圖片清理」功能(掃描 R2 比對資料庫、列清單、確認後刪除),並在刪除/換圖的源頭順手刪 R2,減少孤兒產生。

**架構：** 分兩塊互補 ——(A)後台手動「標記-清除」:列舉 R2 物件、撈齊資料庫所有被引用的圖片 key、找出「沒人用且超過 24 小時」的孤兒,管理員確認後刪除;(C)在代購/連線的刪除與換圖路徑上,刪資料列時 best-effort 刪 R2。C 漏掉的由 A 兜底。

**技術棧：** Next.js(App Router)、tRPC v11、Supabase(service-role)、Cloudflare R2(`@aws-sdk/client-s3`)、shadcn/ui、Tailwind。

## 全域限制

- 回應與程式註解一律繁體中文,不用 emoji。
- R2 物件刪除一律 best-effort:沿用 `lib/r2.ts` 的 `deleteR2Objects`,個別失敗只記 log、不阻擋流程。
- 孤兒安全門檻:預設只刪「上傳超過 **24 小時**」者。掃描程序開放 `minAgeHours` 參數(預設 24)以利後台調整與手動測試。
- 新增的後端程序皆限管理員(`adminProcedure`)。
- R2 key 結構:`images/{purpose}/users/{userId}/{variant}/{uuid}.webp`;banner 為 `images/banner/users/...`。公開網址前綴為 `process.env.R2_PUBLIC_URL`。
- commit 一律等使用者同意才執行。

---

## 檔案結構

- **建立** `server/lib/orphan-images.ts` — 純邏輯:網址轉 key、從 key 推用途、孤兒比對(含年齡門檻)。不依賴 R2/DB,單一職責。
- **修改** `lib/r2.ts` — 新增 `listAllR2Objects(prefix)`(分頁列舉 R2),沿用既有 `s3Client`。
- **建立** `server/routers/storage.ts` — 管理員 router:`collectReferencedKeys`(撈資料庫被引用 key)、`scanOrphanImages`(query)、`deleteOrphanImages`(mutation)。
- **修改** `server/root.ts` — 掛載 `storage` router。
- **建立** `app/(admin)/admin/storage/page.tsx` — 後台清理頁(掃描、列清單顯示用途、確認刪除)。
- **修改** `components/layout/sidebar.tsx` — 後台側欄新增「儲存空間清理」連結。
- **修改** `server/routers/listing.ts` — `delete` 刪 R2。
- **修改** `server/routers/connection.ts` — `delete` 刪 R2。
- **修改** `server/routers/upload.ts` — `confirmListingImages` / `confirmConnectionImages` 換圖刪舊 R2。
- **修改** `docs/platform-overview.md`、`docs/security-review.md` — 同步文件。

---

## Task 1：純邏輯模組 orphan-images

**Files:**
- Create: `server/lib/orphan-images.ts`

**Interfaces:**
- Produces:
  - `type ImagePurpose = 'product' | 'listing' | 'connection' | 'avatar' | 'message' | 'banner'`
  - `interface R2Object { key: string; lastModified: Date; size: number }`
  - `interface Orphan { key: string; purpose: ImagePurpose | 'unknown'; size: number; lastModified: string }`
  - `function r2UrlToKey(url: string | null | undefined, publicBase: string | undefined): string | null`
  - `function purposeFromKey(key: string): ImagePurpose | 'unknown'`
  - `function findOrphans(params: { objects: R2Object[]; referencedKeys: Set<string>; now: Date; minAgeMs: number }): Orphan[]`

- [ ] **Step 1：建立模組**

```ts
// server/lib/orphan-images.ts
export type ImagePurpose =
  | 'product' | 'listing' | 'connection' | 'avatar' | 'message' | 'banner'

export interface R2Object {
  key: string
  lastModified: Date
  size: number
}

export interface Orphan {
  key: string
  purpose: ImagePurpose | 'unknown'
  size: number
  lastModified: string
}

const PURPOSES: ImagePurpose[] = [
  'product', 'listing', 'connection', 'avatar', 'message', 'banner',
]

/** 把公開網址還原成 R2 key;非 R2 網址或空值回傳 null。 */
export function r2UrlToKey(
  url: string | null | undefined,
  publicBase: string | undefined,
): string | null {
  if (!url || !publicBase) return null
  const prefix = publicBase.endsWith('/') ? publicBase : `${publicBase}/`
  if (!url.startsWith(prefix)) return null
  const key = url.slice(prefix.length)
  return key.length > 0 ? key : null
}

/** 從 key 路徑 images/{purpose}/... 推斷用途。 */
export function purposeFromKey(key: string): ImagePurpose | 'unknown' {
  const parts = key.split('/')
  if (parts[0] === 'images' && PURPOSES.includes(parts[1] as ImagePurpose)) {
    return parts[1] as ImagePurpose
  }
  return 'unknown'
}

/** R2 有、引用集合沒有、且上傳超過 minAgeMs 的物件即為孤兒。 */
export function findOrphans(params: {
  objects: R2Object[]
  referencedKeys: Set<string>
  now: Date
  minAgeMs: number
}): Orphan[] {
  const { objects, referencedKeys, now, minAgeMs } = params
  const result: Orphan[] = []
  for (const obj of objects) {
    if (referencedKeys.has(obj.key)) continue
    if (now.getTime() - obj.lastModified.getTime() < minAgeMs) continue
    result.push({
      key: obj.key,
      purpose: purposeFromKey(obj.key),
      size: obj.size,
      lastModified: obj.lastModified.toISOString(),
    })
  }
  return result
}
```

- [ ] **Step 2：型別檢查**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 不出現與 `server/lib/orphan-images.ts` 相關的錯誤(既有 `.next` 產生檔的舊錯誤可忽略)。

- [ ] **Step 3：commit(等使用者同意)**

```bash
git add server/lib/orphan-images.ts
git commit -m "feat(storage): 新增孤兒圖片比對純邏輯"
```

---

## Task 2：R2 列舉能力

**Files:**
- Modify: `lib/r2.ts`

**Interfaces:**
- Consumes: `R2Object` from `server/lib/orphan-images.ts`
- Produces: `function listAllR2Objects(prefix: string): Promise<R2Object[]>`

- [ ] **Step 1：在 `lib/r2.ts` 補列舉**

把 import 改為同時引入 `ListObjectsV2Command`,並新增函式。`s3Client` 已存在,沿用。

```ts
// lib/r2.ts — 將第一行 import 改成：
import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import type { R2Object } from '@/server/lib/orphan-images'
```

在檔案結尾新增:

```ts
/** 分頁列出指定前綴下所有 R2 物件。 */
export async function listAllR2Objects(prefix: string): Promise<R2Object[]> {
  const out: R2Object[] = []
  let token: string | undefined
  do {
    const res = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    )
    for (const obj of res.Contents ?? []) {
      if (obj.Key && obj.LastModified) {
        out.push({ key: obj.Key, lastModified: obj.LastModified, size: obj.Size ?? 0 })
      }
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  return out
}
```

- [ ] **Step 2：型別檢查**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 無 `lib/r2.ts` 相關錯誤。

- [ ] **Step 3：commit(等使用者同意)**

```bash
git add lib/r2.ts
git commit -m "feat(storage): R2 新增分頁列舉能力"
```

---

## Task 3：後端 storage router(掃描 + 刪除)

**Files:**
- Create: `server/routers/storage.ts`
- Modify: `server/root.ts`

**Interfaces:**
- Consumes: `listAllR2Objects` (`lib/r2.ts`)、`deleteR2Objects` (`lib/r2.ts`)、`r2UrlToKey` / `findOrphans` / `Orphan` (`server/lib/orphan-images.ts`)、`adminProcedure` / `router` (`server/trpc`)
- Produces:
  - `storage.scanOrphanImages` query — 入參 `{ minAgeHours?: number }`(預設 24),回傳 `{ orphans: Orphan[]; totalCount: number; totalBytes: number }`
  - `storage.deleteOrphanImages` mutation — 入參 `{ keys: string[] }`,回傳 `{ deleted: number }`

- [ ] **Step 1：建立 router**

```ts
// server/routers/storage.ts
import { z } from 'zod'
import { router, adminProcedure } from '../trpc'
import type { SupabaseClient } from '@supabase/supabase-js'
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

  // 直接是 key 的三張圖片表 + 橫幅
  for (const table of ['product_images', 'listing_images', 'connection_images']) {
    const rows = await selectAllRows<{ r2_key: string | null; thumbnail_r2_key: string | null }>(
      db, table, 'r2_key, thumbnail_r2_key',
    )
    for (const r of rows) { add(r.r2_key); add(r.thumbnail_r2_key) }
  }
  const banners = await selectAllRows<{ image_r2_key: string | null }>(
    db, 'banners', 'image_r2_key',
  )
  for (const b of banners) add(b.image_r2_key)

  // 以網址記錄的:大頭貼(profiles / sellers)、訊息附圖
  for (const table of ['profiles', 'sellers']) {
    const rows = await selectAllRows<{ avatar_url: string | null }>(db, table, 'avatar_url')
    for (const r of rows) addUrl(r.avatar_url)
  }
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
```

- [ ] **Step 2：掛載 router**

`server/root.ts`:import 區塊加入 `import { storageRouter } from './routers/storage'`;`router({ ... })` 內加入一行 `storage: storageRouter,`(放在 `banner: bannerRouter,` 之後)。

- [ ] **Step 3：型別檢查 + lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Run: `npm run lint`
Expected: 無與 `server/routers/storage.ts`、`server/root.ts` 相關錯誤。

- [ ] **Step 4：commit(等使用者同意)**

```bash
git add server/routers/storage.ts server/root.ts
git commit -m "feat(storage): 新增孤兒圖片掃描與刪除 API"
```

---

## Task 4：後台清理頁與側欄

**Files:**
- Create: `app/(admin)/admin/storage/page.tsx`
- Modify: `components/layout/sidebar.tsx`

**Interfaces:**
- Consumes: `storage.scanOrphanImages`、`storage.deleteOrphanImages`(透過 `trpc`)

- [ ] **Step 1：側欄新增連結**

`components/layout/sidebar.tsx`:在 import 的 lucide 圖示加入 `Trash2`;在 `adminLinks` 陣列中 `{ href: '/admin/banners', ... }` 之後加入:

```ts
  { href: '/admin/storage', label: '儲存空間清理', icon: Trash2 },
```

- [ ] **Step 2：建立清理頁**

用途代碼轉中文標籤,清單不分頁,顯示縮圖、用途、大小、上傳時間;先掃描、再確認刪除。

```tsx
// app/(admin)/admin/storage/page.tsx
'use client'

import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

const PURPOSE_LABEL: Record<string, string> = {
  product: '商品',
  listing: '代購',
  connection: '連線',
  avatar: '大頭貼',
  message: '訊息',
  banner: '橫幅',
  unknown: '未知',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function AdminStoragePage() {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL
  const [hasScanned, setHasScanned] = useState(false)

  const scan = trpc.storage.scanOrphanImages.useQuery(
    { minAgeHours: 24 },
    { enabled: false },
  )

  const deleteMut = trpc.storage.deleteOrphanImages.useMutation({
    onSuccess: (res) => {
      toast.success(`已刪除 ${res.deleted} 張孤兒圖片`)
      scan.refetch()
    },
    onError: (e) => toast.error(e.message),
  })

  const orphans = scan.data?.orphans ?? []

  const handleScan = async () => {
    await scan.refetch()
    setHasScanned(true)
  }

  const handleDelete = () => {
    if (orphans.length === 0) return
    if (!confirm(`確定刪除這 ${orphans.length} 張孤兒圖片?此動作無法復原。`)) return
    deleteMut.mutate({ keys: orphans.map((o) => o.key) })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[17px] font-bold font-heading md:text-2xl">儲存空間清理</h1>
        <p className="mt-1 text-muted-foreground">
          掃描 R2 上沒有任何資料庫資料指向、且上傳超過 24 小時的孤兒圖片。先掃描檢視清單,確認後再刪除。
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleScan} disabled={scan.isFetching}>
          {scan.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : '掃描孤兒圖片'}
        </Button>
        {hasScanned && !scan.isFetching && (
          <span className="text-sm text-muted-foreground">
            共 {scan.data?.totalCount ?? 0} 張,可釋放 {formatBytes(scan.data?.totalBytes ?? 0)}
          </span>
        )}
      </div>

      {hasScanned && orphans.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {orphans.map((o) => (
              <div key={o.key} className="rounded-lg border bg-card p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${base}/${o.key}`}
                  alt=""
                  loading="lazy"
                  className="aspect-square w-full rounded object-cover"
                />
                <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  <div className="font-medium text-foreground">{PURPOSE_LABEL[o.purpose] ?? o.purpose}</div>
                  <div>{formatBytes(o.size)}</div>
                  <div>{new Date(o.lastModified).toLocaleString('zh-TW')}</div>
                </div>
              </div>
            ))}
          </div>

          <Button variant="destructive" onClick={handleDelete} disabled={deleteMut.isPending}>
            {deleteMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <><Trash2 className="mr-2 h-4 w-4" />刪除全部 {orphans.length} 張</>
            )}
          </Button>
        </>
      )}

      {hasScanned && !scan.isFetching && orphans.length === 0 && (
        <p className="text-muted-foreground">沒有發現孤兒圖片,儲存空間是乾淨的。</p>
      )}
    </div>
  )
}
```

> 註:預覽圖用到 `NEXT_PUBLIC_R2_PUBLIC_URL`。若專案目前只有伺服器端的 `R2_PUBLIC_URL`,需在 `.env.local` 與部署環境補一個同值的 `NEXT_PUBLIC_R2_PUBLIC_URL`(client 端才讀得到),或改由 `scanOrphanImages` 直接回傳每張的完整 `url`。實作時二擇一,建議後者更省事:在 `Orphan` 型別與 `findOrphans` 增加 `url` 欄位(由 `${R2_PUBLIC_URL}/${key}` 組出),前端直接用 `o.url`。

- [ ] **Step 3：型別檢查 + lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Run: `npm run lint`
Expected: 無相關錯誤。

- [ ] **Step 4：手動驗證**

啟動 `npm run dev`,以管理員登入,進 `/admin/storage`:
1. 按「掃描孤兒圖片」→ 應列出孤兒清單(每張顯示用途、大小、時間)或顯示「沒有發現孤兒圖片」。
2. 若要實測刪除:可先用任一賣家帳號上傳代購圖再刪該代購(C 尚未做時會留孤兒;C 做完後改用 R2 後台手動丟一個假檔測試),把 `minAgeHours` 暫時在程式改 0 以納入剛上傳的檔,驗證掃描→刪除流程後改回 24。

- [ ] **Step 5：commit(等使用者同意)**

```bash
git add "app/(admin)/admin/storage/page.tsx" components/layout/sidebar.tsx
git commit -m "feat(storage): 新增後台孤兒圖片清理頁"
```

---

## Task 5：C 源頭止血 — 刪除與換圖清 R2

**Files:**
- Modify: `server/routers/listing.ts:224-243`
- Modify: `server/routers/connection.ts:139-159`
- Modify: `server/routers/upload.ts`(`confirmListingImages`、`confirmConnectionImages`)

**Interfaces:**
- Consumes: `deleteR2Objects` (`@/lib/r2`)

- [ ] **Step 1：刪代購時清 R2**

`server/routers/listing.ts` 頂部確認已 import `deleteR2Objects`(若無則加 `import { deleteR2Objects } from '@/lib/r2'`)。把 `delete` 內刪除前後改成:

```ts
      const { data: imgs } = await ctx.db
        .from('listing_images')
        .select('r2_key, thumbnail_r2_key')
        .eq('listing_id', input.id)

      await ctx.db.from('listing_images').delete().eq('listing_id', input.id)
      await ctx.db.from('listings').delete().eq('id', input.id)

      const keys = (imgs ?? []).flatMap((i) =>
        [i.r2_key, i.thumbnail_r2_key].filter((k): k is string => !!k),
      )
      if (keys.length > 0) await deleteR2Objects(keys) // best-effort

      return { success: true }
```

- [ ] **Step 2：刪連線時清 R2**

`server/routers/connection.ts` 頂部加 `import { deleteR2Objects } from '@/lib/r2'`(若無)。`delete` 內,在刪 `connections` 之前先撈圖片 key,刪除成功後再刪 R2:

```ts
      const { data: imgs } = await ctx.db
        .from('connection_images')
        .select('r2_key, thumbnail_r2_key')
        .eq('connection_id', input.id)

      const { error } = await ctx.db
        .from('connections')
        .delete()
        .eq('id', input.id)

      if (error) throw error

      const keys = (imgs ?? []).flatMap((i) =>
        [i.r2_key, i.thumbnail_r2_key].filter((k): k is string => !!k),
      )
      if (keys.length > 0) await deleteR2Objects(keys) // best-effort

      return { success: true }
```

- [ ] **Step 3：代購換圖刪舊 R2**

`server/routers/upload.ts` 頂部加 `import { deleteR2Objects } from '@/lib/r2'`。在 `confirmListingImages` 呼叫 `replace_listing_images` RPC **之前**先撈舊 key,RPC 成功**之後**算出被移除的 key 並刪:

```ts
      // 換圖前記下舊 key
      const { data: oldImgs } = await ctx.db
        .from('listing_images')
        .select('r2_key, thumbnail_r2_key')
        .eq('listing_id', input.listing_id)

      const { error } = await ctx.db.rpc('replace_listing_images', {
        p_listing_id: input.listing_id,
        p_images: input.images,
      })

      if (error) throw error

      // 算出被移除的 key(舊 − 新)並刪
      const newKeys = new Set(
        input.images.flatMap((i) => [i.r2_key, i.thumbnail_r2_key]),
      )
      const removed = (oldImgs ?? [])
        .flatMap((i) => [i.r2_key, i.thumbnail_r2_key])
        .filter((k): k is string => !!k && !newKeys.has(k))
      if (removed.length > 0) await deleteR2Objects(removed) // best-effort

      return { success: true }
```

- [ ] **Step 4：連線換圖刪舊 R2**

`server/routers/upload.ts` 的 `confirmConnectionImages` 比照 Step 3,把表名換成 `connection_images`、欄位換成 `connection_id`、RPC 換成 `replace_connection_images`:

```ts
      const { data: oldImgs } = await ctx.db
        .from('connection_images')
        .select('r2_key, thumbnail_r2_key')
        .eq('connection_id', input.connection_id)

      const { error } = await ctx.db.rpc('replace_connection_images', {
        p_connection_id: input.connection_id,
        p_images: input.images,
      })

      if (error) throw error

      const newKeys = new Set(
        input.images.flatMap((i) => [i.r2_key, i.thumbnail_r2_key]),
      )
      const removed = (oldImgs ?? [])
        .flatMap((i) => [i.r2_key, i.thumbnail_r2_key])
        .filter((k): k is string => !!k && !newKeys.has(k))
      if (removed.length > 0) await deleteR2Objects(removed) // best-effort

      return { success: true }
```

- [ ] **Step 5：型別檢查 + lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Run: `npm run lint`
Expected: 無相關錯誤。

- [ ] **Step 6：手動驗證**

`npm run dev`,以賣家登入:
1. 新增一筆代購含圖 → 到 R2 後台確認檔案存在 → 刪掉該代購(需先下架成 inactive/draft)→ 確認 R2 對應檔案已消失。
2. 編輯一筆代購、換掉其中一張圖並送出 → 確認舊圖在 R2 已消失、新圖存在、未被換掉的圖仍在。
3. 連線比照 1、2。

- [ ] **Step 7：commit(等使用者同意)**

```bash
git add server/routers/listing.ts server/routers/connection.ts server/routers/upload.ts
git commit -m "feat(storage): 刪除/換圖時連帶清除 R2 舊檔"
```

---

## Task 6：同步文件

**Files:**
- Modify: `docs/platform-overview.md`
- Modify: `docs/security-review.md`

- [ ] **Step 1：更新 platform-overview**

在儲存/圖片相關段落補一段說明:孤兒圖片清理機制 ——(A)後台 `/admin/storage` 手動掃描比對 R2 與資料庫、列清單確認後刪除、只刪超過 24 小時者;(C)刪代購/連線與換圖時於源頭 best-effort 刪 R2;大頭貼、商品圖、橫幅交由 A 兜底。

- [ ] **Step 2：更新 security-review**

在路由權限表補上 `storage.scanOrphanImages` / `storage.deleteOrphanImages`(管理員限定)。

- [ ] **Step 3：commit(等使用者同意)**

```bash
git add docs/platform-overview.md docs/security-review.md
git commit -m "docs: 補充孤兒圖片清理機制"
```

---

## 自我檢查(對照 spec)

- spec 第四節 A 的七個 key 來源 → Task 3 `collectReferencedKeys` 全涵蓋(product/listing/connection_images 的 r2_key+thumbnail、banners、profiles/sellers avatar、messages 兩欄)。✓
- spec 4.2 唯讀掃描 + 4.3 刪除前重新比對取交集 → Task 3 `scanOrphanImages` / `deleteOrphanImages`。✓
- spec 24 小時門檻、`minAgeHours` 參數 → Task 1 `findOrphans` + Task 3 入參。✓
- spec 4.5 不分頁、顯示用途、縮圖/大小/時間 → Task 4 清單。✓
- spec 第五節 C 四路徑、best-effort、大頭貼/商品/橫幅不在源頭動 → Task 5(僅改代購/連線刪除與換圖)。✓
- spec 第八節文件同步 → Task 6。✓
