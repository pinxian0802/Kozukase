# 代購原商品被移除後的重選與重送

> 最後更新：2026-05-24
> 相關文件：[platform-overview.md](./platform-overview.md)、[seller-flow.md](./seller-flow.md)
> 設計／計畫：`docs/superpowers/specs/2026-05-24-listing-product-removed-reselect-design.md`、`docs/superpowers/plans/2026-05-24-listing-product-removed-reselect.md`

## 概述

當**管理員移除一個商品**時，所有引用該商品的代購（listing）會被自動下架。
由於代購與商品是一對一綁定，下架後代購的 `product_id` 仍指向那個已被移除的商品，
無法直接重新上架。本流程讓賣家能在編輯頁**重新選擇有效商品**（搜尋現有或新增），
重送後進入 `pending_approval` 待管理員再審一次。

此邏輯**只影響代購 (listing)**。連線 (connection) 不綁定特定商品（無 `product_id`、
`ended_reason` 也無 `product_removed`），不受影響；買家前台不受影響（`inactive` 代購本就隱藏）。

## 相關狀態與欄位

| 型別 | 值 | 說明 |
|---|---|---|
| `ListingStatus` | `draft` / `active` / `inactive` / `pending_approval` | 代購狀態 |
| `InactiveReason` | `self` / `expired` / `admin` / `product_removed` | 下架原因 |
| `products.is_removed` | `boolean` | 商品是否被管理員軟刪除 |

關鍵不變式：**復活的閘門看「代購目前指向的商品 `is_removed` 是否為 true」，
而非歷史的 `inactive_reason`**。這讓賣家一旦改指向有效商品，列表標示與可用操作就自動恢復正常。

## 流程一：商品被移除時（自動下架）

觸發點：`server/routers/admin.ts` 的 `removeProduct`。

1. 商品設為 `is_removed = true`、記錄 `removed_at` / `removed_by`。
2. 找出該商品所有 `active` / `pending_approval` 的代購，批次更新為
   `status = 'inactive'`、`inactive_reason = 'product_removed'`。
3. 通知相關賣家（`product_removed`）、商品創建者、許願者、收藏者。

結果：代購落在賣家後台「已下架」分頁，`product_id` 仍指向被移除的商品。

## 流程二：賣家復活（重選 + 重送）

```
已下架(product_removed)
   │  賣家點「編輯」
   ▼
編輯頁偵測 product.is_removed
   │  顯示警示 + 灰階舊商品 + 「重新選擇商品」
   ▼
ProductPicker（搜尋現有 / 新增商品）
   │  選定有效替代品
   ▼
回編輯頁（主鈕「重新送出審核」啟用）
   │  update(帶新 product_id) → reactivate()
   ▼
pending_approval（待審核）
   │  管理員 approveListing
   ▼
active（上線，通知賣家「重新上架已通過審核」）
```

### 後端閘門：`listing.reactivate`

位置：`server/routers/listing.ts` 的 `reactivate`。

- 撈代購時一併帶出 `product:products(is_removed)`。
- 僅 `status === 'inactive'` 可重新上架，否則丟錯。
- **閘門**：若代購目前指向的商品 `is_removed` 仍為 true → 丟出
  「原商品已被移除，請重新選擇商品」。
- **狀態對應**：
  - `inactive_reason` 為 `admin` 或 `product_removed` → `pending_approval`
  - 其餘（`self` / `expired`）→ `active`
  - 一律清空 `inactive_reason`。

> 商品替換本身走 `listing.update`（`updateListingInput` 已支援 `product_id`）。
> `reactivate` 只負責狀態轉換 —— 前端先 `update` 改好 `product_id`，再呼叫 `reactivate`，
> 因此 `reactivate` 不需要 `product_id` 參數。

### 商品選擇的共用單元

- `lib/hooks/use-deferred-product-create.ts`（`useDeferredProductCreate`）：
  封裝「延遲建立商品」—— 商品只在代購送出時才真正寫入 DB（含品牌建立、圖片上傳、
  失敗 rollback、重試快取），避免使用者中途放棄留下孤兒商品。
  對外提供 `setDraft` / `reset` / `createProductForListing`。
- `components/product/product-picker.tsx`（`ProductPicker`）：
  整頁式商品選擇器，內部切換「搜尋現有商品 (`ProductSearch`)」↔「新增商品 (`ProductForm`)」，
  並匯出 `SelectedProduct` 型別。
- 新增代購頁 (`new/page.tsx`) 與編輯頁重選都複用上述兩者。

### 前端行為

**編輯頁** `app/(seller)/dashboard/listings/[id]/edit/page.tsx`
- `productRemoved = listing.product?.is_removed === true`。
- `productRemoved` 時：顯示琥珀色警示、把原商品以灰階呈現、提供「重新選擇商品」開啟 `ProductPicker`。
- 選到替代品後以 `replacement` state 顯示，可再次更換；把 `productId` / `onCreateProduct` /
  `productRemoved` 傳給 `ListingForm`。

**`ListingForm`** `components/listing/listing-form.tsx`
- 新增 `productRemoved` prop；為 true 時不渲染內建唯讀商品卡（由編輯頁負責顯示）。
- `requiresReselect = mode === 'edit' && productRemoved && !hasReplacement`
  （`hasReplacement = !!productId || !!onCreateProduct`）。
- 編輯送出：
  - 主鈕「重新送出審核」(`status === 'active'`)：解析替代品 id（草稿品先 `onCreateProduct`）→
    `update` 帶新 `product_id` → `reactivate` → 進 `pending_approval`；未重選則停用並提示。
  - 次鈕「儲存變更」(`status === 'draft'`)：儲存欄位（含已選替代品），**不** `reactivate`，維持 `inactive`。
- 一般（商品正常）編輯：行為不變 —— 商品唯讀、不帶 `product_id`、不改狀態。

**後台列表** `app/(seller)/dashboard/listings/page.tsx`
- 以 `product.is_removed` 為準：
  - 商品名稱旁顯示紅色「商品已被移除」標示。
  - `inactive` + 商品仍被移除 → 下拉**不顯示**「重新上架」（點了必錯），改走「編輯」進去重選。
  - `inactive` + 商品正常 → 顯示「重新上架」，點擊走 `reactivate`。
- `reactivate` 的成功 toast 依回傳 `status` 顯示：`pending_approval` →「已重新送出，等待審核」；
  其餘 →「已重新上架」。

### 管理員端

`server/routers/admin.ts` 的 `approveListing` 不需特別處理 —— 重送後的代購以 `pending_approval`
自動出現在待審清單，核准後設為 `active` 並通知賣家 `listing_republish_approved`。

## 邊界情況

- **草稿替代品中途失敗**：`createProductForListing` 對圖片上傳失敗會清掉孤兒 R2 物件；
  商品記錄本身保留（屬有效目錄項目）。
- **只儲存不重送**：賣家可用「儲存變更」先存替代品而不送審；之後在列表（此時商品已正常）
  按「重新上架」一樣會進 `pending_approval`（因 `inactive_reason` 仍為 `product_removed`）。
- **重選到的商品又被移除**：`ProductPicker` 只會列出未移除商品；即便發生，`reactivate`
  的閘門仍會擋下並要求重選。

## 關鍵檔案

| 檔案 | 角色 |
|---|---|
| `server/routers/admin.ts` → `removeProduct` / `approveListing` | 移除商品連帶下架、重送後核准 |
| `server/routers/listing.ts` → `reactivate` / `getById` / `myListings` | 復活閘門與狀態、查詢帶 `is_removed` |
| `lib/validators/listing.ts` → `updateListingInput` | 已支援 `product_id`（換商品） |
| `lib/hooks/use-deferred-product-create.ts` | 延遲建立商品 |
| `components/product/product-picker.tsx` | 搜尋／新增商品選擇器 |
| `app/(seller)/dashboard/listings/[id]/edit/page.tsx` | 編輯頁重選 UI |
| `components/listing/listing-form.tsx` | 重送邏輯、按鈕與商品卡控制 |
| `app/(seller)/dashboard/listings/page.tsx` | 列表標示與可用操作 |
