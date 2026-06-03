# 許願榜改版設計

**日期：** 2026-06-03  
**狀態：** 已確認，待實作

---

## 目標

許願榜同時服務兩個目的：

1. **需求聚合（公開）**：讓所有買家的許願可見，形成需求牆，賣家看到後決定上架什麼商品
2. **個人追蹤（私人）**：買家可在收藏頁管理自己的許願清單，有代購上架時收到通知

---

## 資料庫變更

### Migration：`wishes` 表加 `content` 欄位

```sql
ALTER TABLE wishes ADD COLUMN content text NOT NULL DEFAULT '';
ALTER TABLE wishes ALTER COLUMN content DROP DEFAULT;
```

- `content`：必填，紀錄買家的許願說明（例如「想要日本版、深藍色」）
- 國家（產地/代購來源國）存在商品的現有欄位 `products.region_id`，不另外加在 wishes

---

## 後端 API 變更

### 移除

- `wish.toggle`（現有）：拆分為以下兩支

### 新增

**`wish.create`**（protected）
- 輸入：`product_id: string`, `content: string`
- 流程：檢查上限（20 個）→ 新增許願記錄
- 回傳：`{ wished: true }`

**`wish.delete`**（protected）
- 輸入：`product_id: string`
- 流程：找到自己對應的許願 → 刪除
- 回傳：`{ wished: false }`

**`wish.publicFeed`**（public）
- 輸入：`cursor?: string`, `limit: number`（預設 20）
- 排序：`wishes.created_at` 降序（最新在前）
- 回傳欄位：
  - wish：`id`, `content`, `created_at`
  - product：`id`, `name`, `brand`, `model_number`, `catalog_image`
  - profile（許願者）：`id`, `name`, `avatar_url`
- 使用 cursor-based pagination

### 更新

- `wish.myWishes`：SELECT 補上 `content` 欄位，收藏頁需要顯示許願內容
- `wish.topWished`：保留備用（未來若需要熱門排行可復用）

---

## 前端變更

### 1. 許願表單（`/wishes/new`）

移除現有 `ProductForm`，換成專屬的許願表單。

**欄位：**

| 欄位 | 對應 DB 欄位 | 必填 |
|------|------------|------|
| 商品圖片 | `product_images` | ✅ |
| 商品名稱 | `products.name` | ✅ |
| 品牌 | `products.brand_id` | ❌ |
| 型號 | `products.model_number` | ❌ |
| 國家 | `products.region_id` | ✅ |
| 許願內容 | `wishes.content` | ✅ |

**送出流程（前端依序呼叫）：**
1. 若有新品牌名稱 → `brand.create`
2. 建商品 → `product.create`（帶入 name / brand_id / model_number / region_id）
3. 上傳並確認圖片 → `upload.getPresignedUrl` + `upload.confirmProductImage`
4. 建許願 → `wish.create`（帶入 product_id + content）
5. 導向 `/wishes`

**移除：**
- 送出後的「加入許願清單？」確認 Dialog（直接許願，不再二次確認）

---

### 2. 商品詳情頁（`/products/[id]`）

- 移除「許願」按鈕（Heart icon + 許願文字）
- 移除 `wish.toggle` 的 optimistic update 邏輯
- `product.getById` 的 `hasWished` 欄位可保留（暫不處理，不影響功能）

---

### 3. 公開許願榜（`/wishes`）

**從商品 grid 改版為許願 feed：**

- 排序：最新許願在前（`created_at` 降序）
- 呼叫：`wish.publicFeed`（新 API）
- 替換現有的 `wish.topWished` 呼叫

**許願卡片樣式（新元件 `WishCard`）：**
- 商品圖片（正方形縮圖）
- 商品名稱
- 許願內容（截斷過長）
- 許願者頭貼 + 名稱（右下角或卡片底部）

---

### 4. 收藏頁（`/favorites`）

**新增「許願」tab：**

現有 tabs：全部 / 商品 / 代購 / 連線  
新增後：全部 / 商品 / 代購 / 連線 / **許願**

**許願 tab 的卡片（`compact` 樣式）：**
- 商品縮圖 + 名稱（使用現有 `ProductCard` compact variant）
- 許願內容（一行，過長截斷）
- 右側「取消許願」按鈕（呼叫 `wish.delete`）

---

## 不在此次範圍內

- 許願通知機制（`new_listing_for_wish`）：通知邏輯維持現狀，不改動
- `connections.can_wish` 流程：此次不處理
- `topWished` 排行榜頁面：保留 API，UI 此次不另開頁面
- 商品頁 `hasWished` 欄位清理：低優先，不影響功能

---

## 管理員流程（現有功能，不需改動）

用戶提交許願 → 後台「今日新增」出現新商品 → 管理員判斷是否重複 → 若重複，使用現有「合併」功能，將許願、代購、收藏全部轉移到目標商品 → `wish_count` 自動正確累積。
