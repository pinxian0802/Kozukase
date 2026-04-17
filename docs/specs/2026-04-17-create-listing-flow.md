# 新增代購（listings/new）完整流程說明

> 最後更新：2026-04-17

---

## 涉及的檔案

| 檔案 | 角色 |
|------|------|
| `app/(seller)/dashboard/listings/new/page.tsx` | 頁面主控，管理步驟狀態與商品建立 |
| `components/listing/listing-form.tsx` | 上架表單，處理上架資料輸入與送出 |
| `components/shared/image-upload.tsx` | 圖片上傳元件（deferred mode） |
| `app/api/upload/route.ts` | 圖片上傳到 R2 的 Next.js Route Handler |
| `server/routers/upload.ts` | tRPC：confirm 圖片關聯到 DB |
| `server/routers/product.ts` | tRPC：建立商品紀錄 |
| `server/routers/listing.ts` | tRPC：建立上架紀錄 |

---

## 三種圖片相關 API 的區別

### 1. `POST /api/upload`
- **用途**：把瀏覽器選的圖片壓縮後傳到 Cloudflare R2 物件儲存
- **輸入**：`FormData { purpose, file }`（二進位圖片檔案）
- **輸出**：`{ r2Key, publicUrl }`
- **不做**：不寫 Supabase DB、不知道圖片要跟哪個商品或上架紀錄關聯

### 2. `trpc.product.create` / `trpc.listing.create` / `trpc.connection.create`
- **用途**：在 Supabase DB 建立商品、上架、連線的主體紀錄
- **輸入**：業務資料（名稱、價格、規格等）
- **輸出**：新紀錄的 `id`
- **不做**：不碰圖片檔案、不碰 R2

### 3. `trpc.upload.confirmProductImage` / `confirmListingImages` / `confirmConnectionImages`
- **用途**：把第 1 步得到的 `r2Key + url` 跟第 2 步得到的紀錄 `id` 關聯起來，寫入 DB 圖片關聯表
- **輸入**：`{ product_id/listing_id/connection_id, r2_key, url }`
- **輸出**：圖片紀錄

### 為什麼不能合成一個 API？

tRPC 使用 JSON 傳輸，無法在同一個 mutation 裡傳送二進位圖片。圖片必須透過 `FormData` (`POST /api/upload`)，而業務邏輯（建立紀錄、關聯圖片）才能在 tRPC mutation 中處理。這是處理「需要 CDN/物件儲存」場景的標準三段式架構。

---

## 新增代購的完整步驟流程

### Step 0：進入頁面
- 頁面 state 初始化為 `step = { type: 'select' }`
- `createdProductIdRef.current = null`（新增，用來防止重複建立商品）

---

### Step 1：搜尋或建立商品

**路徑 A：選擇既有商品**
```
用戶搜尋 → 點選商品 → step 變成 { type: 'listing', product: { id: '...', name: '...' } }
```
`product.id` 已知，後續無需建立商品。

**路徑 B：建立新商品**
```
用戶搜尋找不到 → 點「新增商品」→ handleOpenCreate(name) 被呼叫
  → createdProductIdRef.current = null（清除舊快取，確保這是全新商品）
  → step 變成 { type: 'create', initialName: name }
```

---

### Step 2：填寫新商品資料（路徑 B 才有）

```
用戶填寫：商品名稱、型號（選填）、目錄圖片（選填）
圖片使用 deferred mode：選擇後不立刻上傳，只暫存為 File 物件 (productPendingFiles)
按「下一步」→ handleContinueToListing()
  → step 變成 { type: 'listing', product: { name, brand, model_number, catalog_image_url: ObjectURL } }
  → 此時 product.id 仍為 undefined（商品還沒建立到 DB）
```

---

### Step 3：填寫上架資料

```
用戶填寫：價格、規格、備註、上架圖片等
上架圖片也是 deferred mode：暫存為 File 物件 (pendingFiles)
按「上架」或「儲存草稿」→ ListingForm.handleSave(status) 開始執行
```

---

### Step 4：送出時的完整執行序列

下面是 `handleSave` 裡面的實際執行順序：

```
handleSave('active')
  │
  ├─ [僅路徑 B] resolvedProductId 是 undefined → 呼叫 onCreateProduct()
  │     也就是 new/page.tsx 的 createProductForListing()
  │
  │   createProductForListing()
  │     │
  │     ├─ 檢查 createdProductIdRef.current
  │     │   ├─ 有值 → 直接 return 已建立的 id（跳過 DB 建立，防止重複）
  │     │   └─ 沒有值 → 繼續往下
  │     │
  │     ├─ [API 1] trpc.product.create → Supabase DB 建立商品
  │     │   → 取得 product.id，立刻存進 createdProductIdRef.current
  │     │
  │     ├─ [API 2/圖片] POST /api/upload → 上傳圖片到 R2，取得 r2Key + url
  │     │
  │     └─ [API 3] trpc.upload.confirmProductImage → DB 關聯圖片
  │
  ├─ [上架圖片] POST /api/upload（如有 pendingFiles）→ 取得 r2Key + url 列表
  │
  ├─ [API] trpc.listing.create → Supabase DB 建立上架紀錄
  │   → 取得 listing.id
  │
  └─ [API] trpc.upload.confirmListingImages → DB 關聯上架圖片

完成 → toast.success → router.push('/dashboard/listings')
```

---

### Step 5：失敗與 retry 行為

**失敗發生在商品建立之前（例如 API 連線問題）：**
```
→ DB 沒有任何新資料，R2 沒有任何新檔案
→ 用戶重試：從頭開始，安全
```

**失敗發生在商品建立成功之後（例如圖片上傳失敗）：**
```
DB 已有商品紀錄 id = "abc-111"
createdProductIdRef.current = "abc-111"  ← 已在失敗前寫入

→ toast.error 顯示錯誤
→ 用戶再按「上架」，handleSave 再次執行
→ createProductForListing() 檢查 ref → 有值 "abc-111"
→ 直接 return "abc-111"，不重新呼叫 createProduct.mutateAsync
→ 繼續上傳圖片、建立上架紀錄
→ 流程正常完成，DB 只有一筆商品紀錄 ✅
```

**用戶主動重新填寫商品（按返回）：**
```
→ handleOpenCreate() 被呼叫
→ createdProductIdRef.current = null  ← 清除快取
→ 下一次送出會建立全新的商品紀錄
```

---

## 目前已知的殘留風險

修改後仍有以下情況不會自動清理，但不影響功能正確性：

| 情況 | 結果 | 嚴重性 |
|------|------|--------|
| 商品圖片上傳到 R2 但 confirm 失敗 | R2 有孤兒檔案，商品存在但沒有圖片 | 低（商品可正常使用，只是沒圖） |
| 上架圖片上傳到 R2 但 createListing 失敗 | R2 有孤兒檔案，上架紀錄未建立 | 低（用戶 retry 會重新上傳） |
| confirmListingImages delete 成功但 insert 失敗 | 上架紀錄存在但圖片消失 | 中（需要用戶重新編輯） |

孤兒 R2 檔案可以透過定期 cron job 掃描清除（與 DB 比對 r2_key 是否存在）。

---

## 技術選擇說明：為什麼用 useRef 而不是 useState

`useRef` 的值改變不會觸發 component re-render，這裡需要的是「靜默快取」而不是「顯示在 UI 上的狀態」，所以選 `useRef`。

如果用 `useState`：
- 修改 `createdProductIdRef` 的地方需要處理非同步 state 更新時序問題
- 會觸發額外多餘的 re-render

---

## 實作的程式碼變更位置

**檔案**：`app/(seller)/dashboard/listings/new/page.tsx`

**變更 1**：import 加入 `useRef`
```tsx
import { useState, useRef } from 'react'
```

**變更 2**：在 component 頂層宣告 ref
```tsx
const createdProductIdRef = useRef<string | null>(null)
```

**變更 3**：`handleOpenCreate` 加入 ref 清除
```tsx
const handleOpenCreate = (name: string) => {
  // ...
  createdProductIdRef.current = null  // 新增
  setStep({ type: 'create', initialName: name })
}
```

**變更 4**：`createProductForListing` 加入 ref 快取邏輯
```tsx
const createProductForListing = async () => {
  // 有快取 → 直接 return，不重複建立
  if (createdProductIdRef.current) {
    return createdProductIdRef.current
  }

  const product = await createProduct.mutateAsync({ ... })

  // 建立成功後立刻快取，後續 retry 安全
  createdProductIdRef.current = product.id

  // ... 圖片上傳
  return product.id
}
```
