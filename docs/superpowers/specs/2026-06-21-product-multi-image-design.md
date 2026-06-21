# 新增商品支援多張圖片（最多 5 張、可排序）

**日期**：2026-06-21
**狀態**：設計確認中

## 目標

讓賣家在「新增商品」這一步（建立全新商品檔案）時，可以上傳**最多 5 張**圖片，並用**上下箭頭調整順序**，第一張自動成為封面（目錄主圖 `catalog_image`）。目前只能上傳 1 張。

## 範圍

- **只動**賣家「新增商品」draft 建立流程（`components/product/product-form.tsx`，標題為「新增商品」的頁面）。此元件被**兩個頁面**共用：
  - `app/(seller)/dashboard/listings/new/page.tsx`（新增代購 → 新建商品）
  - `app/(seller)/dashboard/listings/[id]/edit/page.tsx`（代購被下架後「重新選擇商品 → 新建商品」）
  兩頁都走同一個 `useDeferredProductCreate`，故一次到位、兩頁一致。
- **不動**「選用現有商品」流程（不在那裡新增上傳）。
- **不動**「新增代購」（`listing-form.tsx`）的圖片行為——代購維持現狀（加入順序、無排序按鈕）。排序按鈕只加在商品表單。
- **不動「買家許願」（`app/(buyer)/wishes/new` + `components/buyer/wish-form.tsx`）**：經確認，許願建立商品維持 1 張。它走獨立元件與獨立的單張 `confirmProductImage`，與本次改動互不影響。

## 現況盤點（為何改動其實不大）

資料層早已是「一個商品對多張圖」：

- `product_images` 為一對多（`product_id` FK）。
- `products.catalog_image_id` 指向其中一張作為封面（`fk_catalog_image`）。
- 各 router 查詢早已同時抓 `catalog_image`（單張）與 `product_images`（陣列）。
- 前台商品頁 `app/(buyer)/products/[id]/page-client.tsx` 已用 `catalog_image` + `product_images` 組成 `ImageGallery` 相簿。

真正卡在「只能 1 張」的只有：

1. `product-form.tsx` 用 `SingleImageUpload`（單張）。
2. `useDeferredProductCreate` 只上傳 1 個檔案。
3. 後端 `upload.confirmProductImage` 一次只收 1 張。

另一差異：`product_images` **沒有 `sort_order` 欄位**（`listing_images` / `connection_images` 有）。多張要有穩定順序需補欄位。

## 設計：6 處改動

### 1. 資料庫 migration（`00051_product_images_sort_order.sql`）

```sql
ALTER TABLE product_images
  ADD COLUMN sort_order smallint NOT NULL DEFAULT 0;

-- 回填：每個商品內，封面（catalog_image_id）排 0，其餘依 created_at 接續。
-- 現況多數商品僅 1 張，DEFAULT 0 已足夠；此回填確保未來查詢順序穩定。
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

用 Supabase MCP `apply_migration` 套用到實際資料庫。

### 2. `components/shared/image-upload.tsx`：新增 `reorderable` 選項

- 新增 prop `reorderable?: boolean`（預設 `false`，維持代購／其他用途原樣）。
- 開啟時，每張預覽卡片多一組 **↑ / ↓ 箭頭**（採用上下箭頭，非拖曳——符合既有偏好），第一張顯示「封面」標記。
- 排序操作對象：商品 create 流程中清單只有 `pendingFiles`（全新商品、無既有 images），所以箭頭重排的是 `pendingFiles` 陣列；同理對 `images` 陣列亦可重排。封面＝整體預覽的第一張（create 流程即 `pendingFiles[0]`）。
- 邊界：第一張的 ↑ 與最後一張的 ↓ 禁用。

### 3. `components/product/product-form.tsx`

- `ProductFormData.pendingFile: File | null` → `pendingFiles: File[]`。
- `SingleImageUpload` → `ImageUpload`：`purpose="product"`、`maxImages={5}`、`reorderable`、`pendingFiles` / `onPendingFilesChange`。
- 加上「X / 5」計數與「第一張為封面」提示，樣式比照 listing-form 的商品圖片區。
- 驗證：`pendingFiles.length === 0` → 「商品圖片為必填」。

### 4. 後端 `server/routers/upload.ts`：新增 `confirmProductImages`（複數）

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
```

- 逐張 `assertOwnedR2Key` / `assertUrlMatchesKey`（沿用現有防護）。
- 驗證 `products.created_by === ctx.user.id`。
- 批次 insert 全部列（帶 `sort_order`、`uploaded_by`）。
- 將 `sort_order = 0` 那張的 id 設為 `products.catalog_image_id`（create 流程 `catalog_image_id` 為 null，必設）。
- **保留**原 `confirmProductImage`（單張）：**買家許願 `wishes/new/page.tsx` 仍在使用它**（直接呼叫），不可移除，否則會弄壞許願功能。新增複數端點與舊單張端點並存。

> create-only、無需刪除既有圖，故採「批次 insert + 設封面」即可，不需要像 listing 的 `replace_*` 原子 RPC。失敗時靠前端補償式 rollback 清理。

### 5. `lib/hooks/use-deferred-product-create.ts`

- 讀 `draft.pendingFiles`（陣列）。
- `uploadImageFiles('product', draft.pendingFiles, ...)` 上傳全部。
- 收集所有 `r2Key` / `thumbnailR2Key` 供 rollback。
- 呼叫 `confirmProductImages`，`sort_order = index`。
- 失敗 → `deleteObjects` 刪掉所有已上傳 key（沿用現有 try/catch 模式）。

### 6. 兩個共用 `ProductForm` 的頁面（`handleSubmitDraft`）

`ProductFormData.pendingFile` 改名為 `pendingFiles[]` 後，**兩處** `handleSubmitDraft` 的預覽縮圖都要從 `data.pendingFile` 改為 `data.pendingFiles[0]`：

- `app/(seller)/dashboard/listings/new/page.tsx`（約 L44）
- `app/(seller)/dashboard/listings/[id]/edit/page.tsx`（約 L60，重新選擇商品流程）

兩頁都呼叫 `deferred.setDraft(data)`，無其他差異。

### 7. 相簿排序（吃 `sort_order`）

多張圖會在以下「組相簿」的渲染點出現，需依 `sort_order` 排序。**作法：只在這些渲染點 `select` 出 `sort_order` 並在 client 端排序**，不逐條改動 9＋處 query（較乾淨、風險低）：

- `app/(buyer)/products/[id]/page-client.tsx`（L183 起 `galleryImages`）＋其資料來源查詢（`products/[id]/page.tsx` L35 的 `product_images` 查詢需多取 `sort_order`）。維持「封面在前、其餘按 sort_order」。
- `app/(buyer)/wishes/[id]/page-client.tsx`（L51 起亦用 `product_images` 組相簿）＋對應 `wish` router 查詢補 `sort_order`。
- `components/admin/product-edit-dialog.tsx`（L169 列出 `product_images` 供管理員選封面，標籤「圖片 1/2/3…」順序需穩定）＋ `admin` router 對應查詢補 `sort_order`。

**非相簿、低風險（用 `catalog_image` 或 `product_images[0]` 當縮圖）**：`product-card.tsx`、`listing-form.tsx`（L132–133 選商品縮圖備援）、`admin/today/page.tsx`。這些以 `catalog_image`（明確封面 FK）為主，排序後 `product_images[0]` 才會等於封面；屬加分非必須，不需特別改動。

## 錯誤處理

- 上傳／confirm 任一步失敗：刪除已上傳的 R2 物件（補償式 rollback），商品列已建立則維持（與現有 deferred 流程一致，重試會重用同一 product id）。
- `catalog_image_id` 設定失敗（極少）：相簿仍可由 `product_images` fallback 顯示，不致全空。

## 測試

- 手動驗證為主（依專案偏好，不主動跑 E2E）：
  - 新增代購 → 新建商品：上傳 1 / 3 / 5 張、超過 5 張被擋。
  - 上下箭頭調順序，第一張標示封面。
  - 送出後前台商品頁相簿依序顯示、封面正確。
  - 上傳中途失敗不留孤兒檔。
  - **編輯代購（商品被下架）→ 重新選擇 → 新建商品**：多圖流程同樣可用。
  - **回歸：買家許願 `wishes/new` 仍可正常建立（1 張）**，未受影響（單張端點保留）。
- 既有商品（單張、無 sort_order 回填前）顯示不受影響。

## 不做（YAGNI）

- 不做拖曳排序（用上下箭頭）。
- 不做「選用現有商品」時追加／編輯其圖片。
- 不做 listing 圖片的排序按鈕。
- 不為 product 圖片新增 replace 原子 RPC（create-only 不需要）。
- **不動買家許願（維持 1 張）**，保留單張 `confirmProductImage` 端點。
