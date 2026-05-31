# 賣家「可提供購買證明 / 明細」欄位 + 搜尋篩選

日期：2026-05-29

## 目標

讓買家能辨別賣家是否提供購買證明（例如收據、購買明細），以協助判斷商品是否為正品。

- 賣家可在自己的資料上標示「可提供購買證明 / 明細」。
- 買家在搜尋頁可勾選此條件，只看可提供購買證明的賣家所刊登的商品 / 代購。

本次範圍**只做篩選**，不在前台顯示徽章（但資料會一併回傳，日後加徽章無需改 API）。

## 現有範例（直接比照）

平台已有「只看社群驗證賣家」篩選（`sellers.is_social_verified` → search 的 `social` 參數），本功能完全比照其資料流：賣家身上的布林欄位，在 `product.browse` / `listing.browse` 當篩選條件。

## 設計

### 1. 資料層

新增 migration `supabase/migrations/00043_add_can_provide_proof_to_sellers.sql`：

```sql
ALTER TABLE sellers
  ADD COLUMN can_provide_proof boolean NOT NULL DEFAULT false;
```

- 預設 `false`，現有賣家不受影響。
- 不需要 RLS 變更（`sellers` 既有 policy 已涵蓋整列）。

### 2. 驗證器 `lib/validators/seller.ts`

- `becomeSellerInput`：新增 `can_provide_proof: z.boolean().optional()`。
- `updateSellerInput`：新增 `can_provide_proof: z.boolean().optional()`。

### 3. 賣家 router `server/routers/seller.ts`

- `becomeSeller` 的 insert 物件新增 `can_provide_proof: input.can_provide_proof ?? false`。
- `update` 已用 `...sellerData` 透傳，驗證器加欄位即生效，無需改動。

### 4. 賣家端表單（設定欄位）

兩處各加一個勾選框「可提供購買證明 / 明細」：

- 申請成為賣家：`app/(user)/become-seller/page.tsx`
- 賣家後台編輯資料：`app/(seller)/dashboard/profile/page.tsx`

提交時把 `can_provide_proof` 一併送進對應 mutation。

### 5. 買家端搜尋篩選（比照 `social`）

作用範圍：**商品 + 代購兩個分頁**（與 `social` 一致）。

- `app/(buyer)/search/page-client.tsx`：
  - `filterParsers` 新增 `proof: parseAsBoolean.withDefault(false)`。
  - `useQueryStates` 解構出 `proof`。
  - 篩選面板新增勾選框「可提供購買證明」（放在「社群驗證」附近）。
  - active filter chip 新增 `proof` 標籤，可移除。
  - 把 `proofOnly: proof || undefined` 傳入 `product.browse` 與 `listing.browse`。
  - `serializeSearch` / 返回連結帶上 `proof`。

- `server/routers/product.ts`：
  - browse input 新增 `proofOnly: z.boolean().optional()`。
  - inner join 的 seller 欄位加上 `can_provide_proof`。
  - `if (input.proofOnly) query = query.eq('listings.seller.can_provide_proof', true)`。
  - 回傳的 seller 欄位 select 加上 `can_provide_proof`（供日後徽章用）。

- `server/routers/listing.ts`：
  - browse input 新增 `proofOnly: z.boolean().optional()`。
  - 比照 `socialVerifiedOnly` 的兩段式（先查符合的 seller id 再 `.in`，或直接於現有 seller 篩選步驟加上 `can_provide_proof = true`）。
  - 回傳 seller 欄位加上 `can_provide_proof`。

## 測試

- 既有 Playwright 測試（`tests/seller.spec.ts`、`tests/buyer.spec.ts`）為主要回歸保護。
- 新增 / 擴充：
  - 賣家可設定 `can_provide_proof` 並持久化（becomeSeller + update）。
  - 搜尋帶 `proof=true` 時，只回傳 `can_provide_proof = true` 賣家的商品 / 代購。

## 不在本次範圍（YAGNI）

- 前台徽章顯示。
- 上傳實際的收據 / 證明圖片。
- 平台審核機制。
