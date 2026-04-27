# Image Upload & Display Logic

## Overview

每張非 avatar 圖片在上傳時會產生兩個版本：**original**（完整解析度）和 **thumbnail**（縮圖），分別儲存在 R2 和資料庫中。卡片列表用縮圖、詳細頁用原圖。

---

## Upload Flow

### 前端壓縮（`lib/components/shared/image-upload.tsx`）

| 版本 | 最大尺寸 | 最大檔案大小 | 品質 | 格式 |
|------|---------|------------|------|------|
| original | 1920px | 5 MB | 預設 | WebP |
| thumbnail | 480px | 0.35 MB | 72% | WebP |

- `avatar` 用途：**只上傳 original，不生成 thumbnail**
- 其餘用途（`product` / `listing` / `connection`）：兩個版本都上傳

### R2 路徑規則

```
images/{purpose}/users/{user_id}/original/{uuid}.webp   ← original
images/{purpose}/users/{user_id}/thumbnail/{uuid}.webp  ← thumbnail
```

### Server 端寫入資料庫

| 欄位 | 說明 |
|------|------|
| `r2_key` / `url` | original 的 R2 key 和公開 URL |
| `thumbnail_r2_key` / `thumbnail_url` | thumbnail 的 R2 key 和公開 URL |

新增的欄位存在於 `product_images`、`listing_images`、`connection_images` 三張 table（migration `00017`）。

---

## Display Logic

### 工具函式（`lib/utils/image-variants.mjs`）

```js
getThumbnailUrl(image)   // thumbnail_url → url
getDetailImageUrl(image) // url → thumbnail_url
getCardImageUrl(record)  // 給 ProductCard 用，見下方
```

### 各場景使用規則

| 場景 | 使用版本 | 邏輯 |
|------|---------|------|
| ProductCard（列表） | thumbnail | `getCardImageUrl` → `catalog_image.thumbnail_url → catalog_image.url → catalog_image_url → product_images[0].thumbnail_url` |
| ListingCard（列表） | thumbnail | `listing_images[0].thumbnail_url ?? url` |
| 搜尋結果 | thumbnail | `search_products` RPC：`catalog_img.thumbnail_url → catalog_img.url → fallback_img.thumbnail_url → fallback_img.url` |
| 詳細頁圖片 | original | `getDetailImageUrl` → `url → thumbnail_url` |
| ImageUpload 元件預覽 | original URL（blob preview） | 本地預覽用 `URL.createObjectURL` |

---

## Fallback 行為

### 新圖片（migration 後上傳）
- 正常情況下 `thumbnail_url` 有值，直接使用

### 舊圖片（migration 前已存在）
- migration `00017` 將 `thumbnail_url = url`、`thumbnail_r2_key = r2_key` 回填
- 效果：顯示 thumbnail 位置時仍顯示 original，視覺上無差異，但尚未有實際縮圖

### Code 中的 fallback pattern
```ts
// 表單提交時
thumbnail_r2_key: img.thumbnailR2Key ?? img.r2Key,
thumbnail_url:    img.thumbnailUrl    ?? img.url,
```

---

## 刪除（Rollback）

上傳失敗時，original 和 thumbnail 的 R2 key 都會一起加入 rollback 清單：

```ts
uploadedR2Keys.push(
  ...uploadedImages.flatMap(img =>
    [img.r2Key, img.thumbnailR2Key].filter(Boolean)
  )
)
```

`deleteObjects` endpoint 的安全驗證：key 必須以 `images/{purpose}/users/{user_id}/` 開頭，涵蓋 `original/` 和 `thumbnail/` 兩個子路徑。

---

## Avatar 的特例

- `avatar` 用途**不生成 thumbnail**，`uploadImageFiles` 提前返回 `{ url, r2Key }`
- `SingleImageUpload` 元件的 `onChange` 型別是 `{ url, r2Key }` 也因此沒有 thumbnail 欄位，兩者一致
