# 新增商品多張圖片（最多 5 張、可排序）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓賣家「新增商品」時可上傳最多 5 張圖片、用上下箭頭排序、第一張為封面（目錄主圖）。

**Architecture:** 資料層（`product_images` 一對多 + `products.catalog_image_id` 封面）早已支援多圖，僅前端表單、deferred 建立 hook、與一個確認端點限制為單張。改動＝補 `sort_order` 欄位、新增複數確認端點、表單換多圖元件並加排序、各相簿依 `sort_order` 排序。

**Tech Stack:** Next.js (App Router) + TypeScript、tRPC、Supabase/PostgREST、Cloudflare R2、Playwright（e2e，本計畫不主動執行）。

## Global Constraints

- 上限 **5 張**；`sort_order` 範圍 0–4（`smallint`）。
- 第一張（`sort_order = 0`）＝封面，寫入 `products.catalog_image_id`。
- 排序用 **上下箭頭**，不用拖曳。
- **保留**單張 `upload.confirmProductImage` 端點（買家許願 `wishes/new` 仍在用，移除會壞）。
- **不動**買家許願（維持 1 張）與代購 `listing-form` 圖片行為。
- 本專案無單元測試框架；驗證採 `npx tsc --noEmit` + `npm run lint` + 手動點測（依偏好不主動跑 Playwright）。
- Commit 步驟列於計畫中，但依使用者偏好「不主動 commit」，實際是否 commit 由使用者決定。
- 資料庫 migration 以 Supabase MCP `apply_migration` 套用到實際資料庫。

---

## File Structure

| 檔案 | 角色 | Task |
|---|---|---|
| `supabase/migrations/00051_product_images_sort_order.sql` | 新增 `sort_order` 欄位＋回填 | 1 |
| `server/routers/upload.ts` | 新增 `confirmProductImages`（複數，保留單張） | 2 |
| `components/shared/image-upload.tsx` | 新增 `reorderable`：↑/↓ 排序 + 封面標記 | 3 |
| `components/product/product-form.tsx` | 單張→多張、`pendingFile`→`pendingFiles[]` | 4 |
| `lib/hooks/use-deferred-product-create.ts` | 上傳全部、帶 sort_order、rollback 全部 | 4 |
| `app/(seller)/dashboard/listings/new/page.tsx` | `handleSubmitDraft` 用 `pendingFiles[0]` | 4 |
| `app/(seller)/dashboard/listings/[id]/edit/page.tsx` | 同上（重新選擇商品流程） | 4 |
| `server/routers/product.ts` `wish.ts` `admin.ts` | select 補 `sort_order` | 5 |
| `app/(buyer)/products/[id]/page-client.tsx` | 相簿依 `sort_order` 排序 | 5 |
| `app/(buyer)/wishes/[id]/page-client.tsx` | 相簿依 `sort_order` 排序 | 5 |
| `components/admin/product-edit-dialog.tsx` | 封面選擇清單依 `sort_order` | 5 |

---

## Task 1: 資料庫 — `product_images.sort_order`

**Files:**
- Create: `supabase/migrations/00051_product_images_sort_order.sql`

**Interfaces:**
- Produces: `product_images.sort_order smallint NOT NULL DEFAULT 0`，供 Task 2/5 使用。

- [ ] **Step 1: 寫 migration 檔**

`supabase/migrations/00051_product_images_sort_order.sql`：

```sql
-- 商品圖片支援多張並可排序:product_images 原無 sort_order(listing_images /
-- connection_images 有),多張時順序不穩定。新增 sort_order,並回填現有資料——
-- 每個商品內,封面(catalog_image_id)排 0,其餘依 created_at 接續。
ALTER TABLE product_images
  ADD COLUMN sort_order smallint NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT pi.id,
         ROW_NUMBER() OVER (
           PARTITION BY pi.product_id
           ORDER BY (p.catalog_image_id = pi.id) DESC, pi.created_at
         ) - 1 AS rn
  FROM product_images pi
  JOIN products p ON p.id = pi.product_id
)
UPDATE product_images pi
SET sort_order = ordered.rn
FROM ordered
WHERE ordered.id = pi.id;
```

- [ ] **Step 2: 用 Supabase MCP 套用到實際資料庫**

用 `mcp__supabase__apply_migration`，`name` = `product_images_sort_order`，`query` = 上述 SQL。

- [ ] **Step 3: 驗證欄位存在**

用 `mcp__supabase__execute_sql` 執行：
```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'product_images' AND column_name = 'sort_order';
```
Expected: 回傳一列，`data_type = smallint`、`is_nullable = NO`、`column_default = 0`。

- [ ] **Step 4: 驗證回填正確**

```sql
SELECT product_id, count(*) AS imgs, array_agg(sort_order ORDER BY sort_order) AS orders
FROM product_images GROUP BY product_id ORDER BY imgs DESC LIMIT 5;
```
Expected: 每個商品的 `orders` 從 0 連續遞增（多數商品僅 `{0}`）。

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00051_product_images_sort_order.sql
git commit -m "feat(db): product_images 新增 sort_order 支援多圖排序"
```

---

## Task 2: 後端 — `confirmProductImages`（複數）

**Files:**
- Modify: `server/routers/upload.ts`（在既有 `confirmProductImage` 之後新增；**不刪**單張版）

**Interfaces:**
- Consumes: Task 1 的 `product_images.sort_order`；既有 `assertOwnedR2Key` / `assertUrlMatchesKey` / `TRPCError` / `z`（檔案內已 import）。
- Produces: `trpc.upload.confirmProductImages.mutateAsync({ product_id: string, images: { r2_key, url, thumbnail_r2_key, thumbnail_url, sort_order }[] }) => { success: true }`，供 Task 4 呼叫。

- [ ] **Step 1: 新增端點**

在 `server/routers/upload.ts` 中，緊接 `confirmProductImage` 的 `}),` 之後插入：

```ts
  confirmProductImages: protectedProcedure
    .input(z.object({
      product_id: z.string().uuid(),
      images: z.array(z.object({
        r2_key: z.string().min(1).max(500),
        url: z.string().url(),
        thumbnail_r2_key: z.string().min(1).max(500),
        thumbnail_url: z.string().url(),
        sort_order: z.number().min(0).max(4),
      })).min(1).max(5),
    }))
    .mutation(async ({ ctx, input }) => {
      for (const img of input.images) {
        assertOwnedR2Key(img.r2_key, 'product', ctx.user.id)
        assertOwnedR2Key(img.thumbnail_r2_key, 'product', ctx.user.id)
        assertUrlMatchesKey(img.url, img.r2_key)
        assertUrlMatchesKey(img.thumbnail_url, img.thumbnail_r2_key)
      }

      const { data: product } = await ctx.db
        .from('products')
        .select('created_by, catalog_image_id')
        .eq('id', input.product_id)
        .single()

      if (!product) throw new TRPCError({ code: 'NOT_FOUND' })
      if (product.created_by !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' })

      const { data: inserted, error } = await ctx.db
        .from('product_images')
        .insert(input.images.map((img) => ({
          product_id: input.product_id,
          r2_key: img.r2_key,
          url: img.url,
          thumbnail_r2_key: img.thumbnail_r2_key,
          thumbnail_url: img.thumbnail_url,
          sort_order: img.sort_order,
          uploaded_by: ctx.user.id,
        })))
        .select('id, sort_order')

      if (error) throw error

      // 封面未設定時(全新商品),把 sort_order = 0 那張設為 catalog_image。
      if (!product.catalog_image_id) {
        const cover = inserted?.find((row) => row.sort_order === 0) ?? inserted?.[0]
        if (cover) {
          await ctx.db
            .from('products')
            .update({ catalog_image_id: cover.id })
            .eq('id', input.product_id)
        }
      }

      return { success: true }
    }),
```

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤（若報 `ctx.db` insert 型別問題，確認其他 insert 同樣未加泛型，沿用即可）。

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: 無新增 error。

- [ ] **Step 4: Commit**

```bash
git add server/routers/upload.ts
git commit -m "feat(upload): 新增 confirmProductImages 複數端點(保留單張版)"
```

---

## Task 3: `ImageUpload` 新增 `reorderable`（↑/↓ 排序 + 封面標記）

**Files:**
- Modify: `components/shared/image-upload.tsx`

**Interfaces:**
- Consumes: 既有 `images: UploadedImage[]` / `onChange` / `pendingFiles?: File[]` / `onPendingFilesChange?`。
- Produces: 新 prop `reorderable?: boolean`（預設 false）。供 Task 4 的 product-form 使用。

> 說明:product-form 永遠只有 `pendingFiles`(全新商品、無既有 `images`),故排序在各自陣列內相鄰交換即可;第一張(整體 index 0)顯示「封面」徽章。

- [ ] **Step 1: import 箭頭 icon**

把第 4 行：
```ts
import { ImageIcon, Loader2, Upload, X } from 'lucide-react'
```
改為：
```ts
import { ChevronDown, ChevronUp, ImageIcon, Loader2, Upload, X } from 'lucide-react'
```

- [ ] **Step 2: 新增 prop 到 interface**

在 `ImageUploadProps`（約 L13–23）的 `invalid?: boolean` 之後加一行：
```ts
  invalid?: boolean
  reorderable?: boolean
```

- [ ] **Step 3: 解構 prop**

在 `export function ImageUpload({ ... })` 參數列（約 L125–135）的 `invalid,` 之後加 `reorderable,`：
```ts
  className,
  invalid,
  reorderable,
}: ImageUploadProps) {
```

- [ ] **Step 4: 新增交換 helper**

在 `removePendingFile`（約 L244–246）之後新增：
```ts
  const moveImage = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= images.length) return
    const next = [...images]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const movePending = (index: number, dir: -1 | 1) => {
    const arr = [...(pendingFiles ?? [])]
    const target = index + dir
    if (target < 0 || target >= arr.length) return
    ;[arr[index], arr[target]] = [arr[target], arr[index]]
    onPendingFilesChange?.(arr)
  }
```

- [ ] **Step 5: images 卡片加封面徽章＋排序鈕**

在 `images.map((img, index) => ...)` 的 `<CardContent>` 內、`removeImage` 的 `<Button>` 之後（約 L327，`</Button>` 後）插入：
```tsx
                {reorderable && (
                  <>
                    {index === 0 && (
                      <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground shadow-sm">封面</span>
                    )}
                    <div className="absolute bottom-2 left-2 flex gap-1">
                      <Button type="button" variant="secondary" size="icon-sm" disabled={index === 0} onClick={() => moveImage(index, -1)} className="rounded-full bg-background/90 text-foreground shadow-sm hover:bg-background disabled:opacity-40">
                        <ChevronUp className="h-3 w-3" />
                        <span className="sr-only">上移</span>
                      </Button>
                      <Button type="button" variant="secondary" size="icon-sm" disabled={index === images.length - 1} onClick={() => moveImage(index, 1)} className="rounded-full bg-background/90 text-foreground shadow-sm hover:bg-background disabled:opacity-40">
                        <ChevronDown className="h-3 w-3" />
                        <span className="sr-only">下移</span>
                      </Button>
                    </div>
                  </>
                )}
```

- [ ] **Step 6: pending 卡片加封面徽章＋排序鈕**

在 `pendingPreviews.map((item, index) => ...)` 內、`removePendingFile` 的 `<Button>` 之後（約 L353，`</Button>` 後）插入：
```tsx
                  {reorderable && (
                    <>
                      {previewIndex === 0 && (
                        <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground shadow-sm">封面</span>
                      )}
                      <div className="absolute bottom-2 left-2 flex gap-1">
                        <Button type="button" variant="secondary" size="icon-sm" disabled={index === 0} onClick={() => movePending(index, -1)} className="rounded-full bg-background/90 text-foreground shadow-sm hover:bg-background disabled:opacity-40">
                          <ChevronUp className="h-3 w-3" />
                          <span className="sr-only">上移</span>
                        </Button>
                        <Button type="button" variant="secondary" size="icon-sm" disabled={index === (pendingFiles?.length ?? 0) - 1} onClick={() => movePending(index, 1)} className="rounded-full bg-background/90 text-foreground shadow-sm hover:bg-background disabled:opacity-40">
                          <ChevronDown className="h-3 w-3" />
                          <span className="sr-only">下移</span>
                        </Button>
                      </div>
                    </>
                  )}
```

> 註:`previewIndex` 已於 pending map 內定義（`const previewIndex = images.length + index`）。product 情境 `images.length === 0`,故 `previewIndex === index`,第一張即封面。

- [ ] **Step 7: 型別檢查 + Lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 無錯誤。

- [ ] **Step 8: Commit**

```bash
git add components/shared/image-upload.tsx
git commit -m "feat(image-upload): 新增 reorderable 上下排序與封面標記"
```

---

## Task 4: 商品多圖串接（product-form + deferred hook + 兩頁）

**Files:**
- Modify: `components/product/product-form.tsx`
- Modify: `lib/hooks/use-deferred-product-create.ts`
- Modify: `app/(seller)/dashboard/listings/new/page.tsx`
- Modify: `app/(seller)/dashboard/listings/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: Task 2 `trpc.upload.confirmProductImages`、Task 3 `ImageUpload reorderable`。
- Produces: `ProductFormData.pendingFiles: File[]`（取代 `pendingFile: File | null`）。

> 此 4 檔須一起改:`ProductFormData` 型別更名會同時讓兩頁與 hook 編譯失敗,屬同一原子變更。

- [ ] **Step 1: product-form 換 import**

`components/product/product-form.tsx` 第 10 行：
```ts
import { SingleImageUpload } from '@/components/shared/single-image-upload'
```
改為：
```ts
import { ImageUpload } from '@/components/shared/image-upload'
```

- [ ] **Step 2: 改型別與 state**

`ProductFormData`（L19–26）中：
```ts
  pendingFile: File | null
```
改為：
```ts
  pendingFiles: File[]
```

state（L41）：
```ts
  const [pendingFile, setPendingFile] = useState<File | null>(null)
```
改為：
```ts
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
```

- [ ] **Step 3: 改驗證與送出**

`handleContinue` 內（L59–64）：
```ts
    if (!pendingFile) {
      setImageError('商品圖片為必填')
      hasError = true
    } else {
      setImageError('')
    }
```
改為：
```ts
    if (pendingFiles.length === 0) {
      setImageError('商品圖片為必填')
      hasError = true
    } else {
      setImageError('')
    }
```

`onContinue({ ... })`（L71–78）中的 `pendingFile,` 改為 `pendingFiles,`。

- [ ] **Step 4: 換 UI 為多圖**

把 L97–114 的「商品圖片」區塊：
```tsx
          <div>
            <Label>商品圖片</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">請上傳與商品直接相關的圖片（商品本體照或官方圖），建議 800×800 px 以上、正方形</p>
            <div className="mt-1.5">
              <SingleImageUpload
                purpose="product"
                value={null}
                onChange={() => {}}
                pendingFile={pendingFile}
                onPendingFileChange={(file) => {
                  setPendingFile(file)
                  if (file && imageError) setImageError('')
                }}
                invalid={!!imageError}
              />
            </div>
            <FormFieldError message={imageError} />
          </div>
```
改為：
```tsx
          <div>
            <Label>
              商品圖片
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">{pendingFiles.length} / 5</span>
            </Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">第一張為封面。請上傳與商品直接相關的圖片（商品本體照或官方圖），建議 800×800 px 以上、正方形</p>
            <div className="mt-1.5">
              <ImageUpload
                purpose="product"
                maxImages={5}
                reorderable
                images={[]}
                onChange={() => {}}
                pendingFiles={pendingFiles}
                onPendingFilesChange={(files) => {
                  setPendingFiles(files)
                  if (files.length > 0 && imageError) setImageError('')
                }}
                invalid={!!imageError}
              />
            </div>
            <FormFieldError message={imageError} />
          </div>
```

- [ ] **Step 5: deferred hook 換端點與多圖上傳**

`lib/hooks/use-deferred-product-create.ts` 第 20 行：
```ts
  const confirmProductImage = trpc.upload.confirmProductImage.useMutation()
```
改為：
```ts
  const confirmProductImages = trpc.upload.confirmProductImages.useMutation()
```

把 L60–79 的單張上傳區塊：
```ts
    if (draft.pendingFile) {
      const uploaded = await uploadImageFiles('product', [draft.pendingFile], getPresignedUrl.mutateAsync)
      if (uploaded[0]) {
        try {
          await confirmProductImage.mutateAsync({
            product_id: product.id,
            r2_key: uploaded[0].r2Key,
            url: uploaded[0].url,
            thumbnail_r2_key: uploaded[0].thumbnailR2Key ?? uploaded[0].r2Key,
            thumbnail_url: uploaded[0].thumbnailUrl ?? uploaded[0].url,
          })
        } catch (err) {
          // confirmProductImage failed: clean up the orphan R2 object.
          await deleteObjects.mutateAsync({
            r2Keys: [uploaded[0].r2Key, uploaded[0].thumbnailR2Key].filter(Boolean) as string[],
          }).catch(() => {})
          throw err
        }
      }
    }
```
改為：
```ts
    if (draft.pendingFiles.length > 0) {
      const uploaded = await uploadImageFiles('product', draft.pendingFiles, getPresignedUrl.mutateAsync)
      const uploadedKeys = uploaded.flatMap((img) => [img.r2Key, img.thumbnailR2Key].filter(Boolean) as string[])
      try {
        await confirmProductImages.mutateAsync({
          product_id: product.id,
          images: uploaded.map((img, i) => ({
            r2_key: img.r2Key,
            url: img.url,
            thumbnail_r2_key: img.thumbnailR2Key ?? img.r2Key,
            thumbnail_url: img.thumbnailUrl ?? img.url,
            sort_order: i,
          })),
        })
      } catch (err) {
        // confirmProductImages failed: clean up the orphan R2 objects.
        await deleteObjects.mutateAsync({ r2Keys: uploadedKeys }).catch(() => {})
        throw err
      }
    }
```

- [ ] **Step 6: 兩頁 handleSubmitDraft 改縮圖來源**

`app/(seller)/dashboard/listings/new/page.tsx` L44：
```ts
      catalog_image_url: data.pendingFile ? URL.createObjectURL(data.pendingFile) : null,
```
改為：
```ts
      catalog_image_url: data.pendingFiles[0] ? URL.createObjectURL(data.pendingFiles[0]) : null,
```

`app/(seller)/dashboard/listings/[id]/edit/page.tsx` L60：同樣把 `data.pendingFile`（兩處：判斷與 `URL.createObjectURL` 參數）改為 `data.pendingFiles[0]`：
```ts
      catalog_image_url: data.pendingFiles[0] ? URL.createObjectURL(data.pendingFiles[0]) : null,
```

- [ ] **Step 7: 型別檢查 + Lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 無錯誤（特別確認 `wishes/new/page.tsx`、`wish-form.tsx` 不受影響，因其用獨立的 `WishFormData.pendingFile`）。

- [ ] **Step 8: 手動驗證（dev）**

Run: `npm run dev`，登入賣家帳號，前往「新增代購」：
- 新建商品步驟可選/拖入多張，超過 5 張顯示「最多只能加入 N 張圖片」。
- 每張有 ↑/↓，可調序；第一張顯示「封面」。
- 完成建立後，至「新增代購」下一步可正常送出。
- 另測「編輯代購（商品被下架）→ 重新選擇商品 → 新建商品」多圖流程可用。

- [ ] **Step 9: Commit**

```bash
git add components/product/product-form.tsx lib/hooks/use-deferred-product-create.ts "app/(seller)/dashboard/listings/new/page.tsx" "app/(seller)/dashboard/listings/[id]/edit/page.tsx"
git commit -m "feat(product): 新增商品支援最多 5 張可排序圖片"
```

---

## Task 5: 各相簿依 `sort_order` 排序

**Files:**
- Modify: `server/routers/product.ts`
- Modify: `server/routers/wish.ts`
- Modify: `server/routers/admin.ts`
- Modify: `app/(buyer)/products/[id]/page-client.tsx`
- Modify: `app/(buyer)/wishes/[id]/page-client.tsx`
- Modify: `components/admin/product-edit-dialog.tsx`

**Interfaces:**
- Consumes: Task 1 `product_images.sort_order`。
- Produces: 各相簿/封面清單依 `sort_order` 穩定排序。

> 作法:在「組相簿」的 router select 補抓 `sort_order`,再於渲染處 client 端排序。不逐條改 9＋查詢。

- [ ] **Step 1: product router 補 `sort_order`**

`server/routers/product.ts` 內，所有
```
product_images:product_images!product_images_product_id_fkey(id, url, r2_key, thumbnail_url, thumbnail_r2_key)
```
改為（共 2 處，L56、L156）：
```
product_images:product_images!product_images_product_id_fkey(id, url, r2_key, thumbnail_url, thumbnail_r2_key, sort_order)
```

- [ ] **Step 2: wish router 補 `sort_order`**

`server/routers/wish.ts` 內，`getById` 餵商品相簿的 product_images select（L137 與 L160）補上 `sort_order`：
- L137：`product_images:product_images!product_images_product_id_fkey(id, url, thumbnail_url)` → 末尾加 `, sort_order`
- L160：`product_images:product_images!product_images_product_id_fkey(id, url, r2_key, thumbnail_url, thumbnail_r2_key)` → 末尾加 `, sort_order`

- [ ] **Step 3: admin router 補 `sort_order`**

`server/routers/admin.ts` 內，餵 product-edit-dialog 的查詢 product_images select（L493、L550）末尾加 `, sort_order`：
```
product_images:product_images!product_images_product_id_fkey(id, url, r2_key, thumbnail_url, thumbnail_r2_key, sort_order)
```

- [ ] **Step 4: 商品頁相簿排序**

`app/(buyer)/products/[id]/page-client.tsx` 的 `galleryImages`（約 L183）：
```ts
  const galleryImages = [
    ...(product.catalog_image ? [{ url: product.catalog_image.url, alt: product.name }] : []),
    ...(product.product_images ?? [])
      .filter((image: any) => image.id !== product.catalog_image?.id)
      .map((image: any) => ({ url: image.url, alt: product.name })),
  ]
```
改為：
```ts
  const galleryImages = [
    ...(product.catalog_image ? [{ url: product.catalog_image.url, alt: product.name }] : []),
    ...(product.product_images ?? [])
      .filter((image: any) => image.id !== product.catalog_image?.id)
      .slice()
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((image: any) => ({ url: image.url, alt: product.name })),
  ]
```

- [ ] **Step 5: 許願頁相簿排序**

`app/(buyer)/wishes/[id]/page-client.tsx` 的 `galleryImages`（約 L49）：
```ts
    ...((product.product_images ?? []) as any[])
      .filter((image) => image.id !== catalogImage?.id)
      .map((image) => ({ url: image.url, alt: product.name })),
```
改為：
```ts
    ...((product.product_images ?? []) as any[])
      .filter((image) => image.id !== catalogImage?.id)
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((image) => ({ url: image.url, alt: product.name })),
```

- [ ] **Step 6: admin 封面清單排序**

`components/admin/product-edit-dialog.tsx`：
1. 型別 `AdminProductImage`（約 L25–32 區）加 `sort_order?: number`。
2. 在 component 內、`imageLabelById` 之前新增已排序陣列：
```ts
  const sortedImages = (product?.product_images ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
```
3. `imageLabelById`（L65–68）改用 `sortedImages`：
```ts
  const imageLabelById = new Map([
    ['none', '不指定'],
    ...sortedImages.map((image, index) => [image.id, `圖片 ${index + 1}`] as const),
  ])
```
4. SelectItems（L169）`{(product.product_images ?? []).map(...)}` 改為 `{sortedImages.map((image, index) => (`，內容不變。

- [ ] **Step 7: 型別檢查 + Lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 無錯誤。

- [ ] **Step 8: 手動驗證**

於 `npm run dev`：
- 用 Task 4 建好的多圖商品，開商品頁 `products/[id]`：相簿封面在前、其餘依序。
- 管理員後台開該商品編輯：封面下拉「圖片 1/2/3…」順序穩定、可改封面。

- [ ] **Step 9: Commit**

```bash
git add server/routers/product.ts server/routers/wish.ts server/routers/admin.ts "app/(buyer)/products/[id]/page-client.tsx" "app/(buyer)/wishes/[id]/page-client.tsx" components/admin/product-edit-dialog.tsx
git commit -m "feat(product): 各相簿依 sort_order 排序商品圖片"
```

---

## Self-Review

**Spec coverage:**
- 6 處改動 → Task 1（DB）、Task 2（後端複數端點，保留單張）、Task 3（ImageUpload reorderable）、Task 4（product-form + deferred + new/edit 兩頁）、Task 5（相簿排序：product/wish/admin router + 3 渲染處）。✅
- 「保留單張端點」「編輯代購頁一起改」「許願不動」皆涵蓋。✅

**Placeholder scan:** 無 TODO/TBD；每段皆附完整程式碼與指令。✅

**Type consistency:** `ProductFormData.pendingFiles: File[]` 於 product-form 定義、deferred hook 與兩頁消費一致；`confirmProductImages` 輸入型別於 Task 2 定義、Task 4 呼叫一致；`reorderable` prop 於 Task 3 定義、Task 4 使用一致；`sort_order` 於 Task 1 建立、Task 2/5 使用一致。✅

**docs:** 依偏好,實作後更新 `docs/platform-overview.md`（若其描述商品圖片為單張）— 收尾時檢查。
