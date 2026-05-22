# Dashboard Listings / Connections 表格化重構

**日期:** 2026-05-21
**範圍:** `app/(seller)/dashboard/listings/page.tsx`、`app/(seller)/dashboard/connections/page.tsx`

## 目標

把目前兩個「卡片式 row + 一格塞多值」的列表頁改成真正的表格 (table) 排版,一欄只顯示一個值,只挑重要欄位。手機尺寸自動 fallback 回卡片。

不在範圍內:後端 router、tRPC schema、商品/連線編輯頁、其他 dashboard 頁面。

## 欄位定義

### 代購管理 (`/dashboard/listings`) — 7 欄

| # | 欄位 | 來源 | 備註 |
|---|---|---|---|
| 1 | 圖片 | `listing.listing_images[0].thumbnail_url`,fallback 至 `product.catalog_image` | 點開 lightbox 預覽全部圖片 |
| 2 | 標題 | `listing.title` | |
| 3 | 商品名稱 | `listing.product?.name` | 連結至 `/products/{product_id}` |
| 4 | 售價 | `formatPrice(listing.price, listing.is_price_on_request)` | 加粗 |
| 5 | 截止日 | `listing.expires_at` | `formatDate` |
| 6 | 狀態 | `listing.status` | 圓點 + 文字 (draft/active/inactive/pending_approval) |
| 7 | 操作 | — | 按狀態決定按鈕,並排 |

**移除欄位:** 預計出貨、規格摘要、查看貼文 — 改在編輯頁/詳情看。

### 連線管理 (`/dashboard/connections`) — 7 欄

| # | 欄位 | 來源 | 備註 |
|---|---|---|---|
| 1 | 圖片 | `conn.connection_images[0].thumbnail_url` | 點開 lightbox |
| 2 | 標題 | `conn.title` | |
| 3 | 國家 | `conn.region?.name` | |
| 4 | 連線日期 | `formatDate(conn.start_date) ~ formatDate(conn.end_date)` | 單欄,以「~」分隔 |
| 5 | 預計出貨 | `conn.shipping_date` | |
| 6 | 狀態 | `conn.status` | 圓點 + 文字 (active/ended/pending_approval) + `can_wish` 旁邊小 badge |
| 7 | 操作 | — | 按狀態決定按鈕,並排 |

**移除欄位:** 地點、計費方式、品牌、貼文/群組連結 — 改在編輯頁/詳情看。

## 視覺風格 (Style B — Soft)

- 表格容器:白底、`rounded-xl`、subtle shadow
- Header:`bg-muted/50`、`text-xs uppercase tracking-wider text-muted-foreground`、bottom border
- Row:橫向細分隔線 (`border-b border-muted`)、無垂直框線、`hover:bg-muted/30`
- Padding:cell `px-3 py-3`,垂直置中
- Thumbnail:`w-12 h-12 rounded-lg`
- 狀態圓點:`w-2 h-2 rounded-full` + 文字(顏色沿用現有 `statusDotColors`)
- 操作按鈕:`size="sm"`,並排;按鈕 `stopPropagation` 避免觸發 row click

## 互動

- **Row click** → 進入該項目的編輯頁 (`/dashboard/listings/{id}/edit` 或 `/dashboard/connections/{id}/edit`)
- **圖片 cell click** → 開 lightbox,**不**觸發 row click
- **操作按鈕 click** → 執行 mutation,**不**觸發 row click
- **商品名稱連結 click**(僅 listings) → 進商品頁,**不**觸發 row click

實作上:row 用 `<tr onClick={navigateToEdit}>`;cell 內所有 interactive element 都 `e.stopPropagation()`。

## RWD (Card fallback)

斷點:`lg` (1024px) 以下切換成卡片清單。

桌機 (`lg+`):shadcn `<Table>`,7 欄
手機/平板 (`<lg`):每筆資料一張卡片:
- 頂部:thumbnail + 標題 + 狀態圓點(同一行)
- 中段:key/value 對排,每行一個欄位(商品名/售價/截止日 或 國家/連線日期/預計出貨)
- 底部:操作按鈕橫排

## 狀態行為與操作按鈕

### Listings
- `draft` → 編輯 · 上架 · 刪除
- `active` → 編輯 · 下架
- `inactive` → 編輯 · 重新上架 · 刪除
- `pending_approval` → 編輯 · `Badge: 等待審核結果`

### Connections
- `active` → 編輯 · 結束
- `ended` → 編輯 · 重新上架 · 刪除
- `pending_approval` → 編輯 · `Badge: 等待審核結果`

(完全沿用現有邏輯,沒有改變)

## 程式碼結構

兩個頁面結構幾乎相同,自然會生出共用元件。共用 vs 各自寫的取捨:

**新增的共用元件 (`components/dashboard/`):**
- `dashboard-list-shell.tsx` — Header (標題+計數+新增按鈕)、Tabs、Skeleton、EmptyState 的容器骨架。`children` 是表格或卡片。
- `dashboard-status-dot.tsx` — 圓點 + 文字,接 `status` 與 mapping。
- `dashboard-thumbnail-cell.tsx` — 縮圖 + lightbox 整合(整合 `ListingThumbnail` / `ConnectionThumbnail`)。`fallbackIcon` prop 控制 Package vs Globe。

**新增的 UI primitive (`components/ui/table.tsx`):**
- 直接用 shadcn `table.tsx`(`Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`)。從官方範本複製到專案內,不裝額外套件。

**頁面本身:**
- `listings/page.tsx` 跟 `connections/page.tsx` 各自留下:狀態 mapping、欄位定義、tRPC query/mutation、行渲染邏輯。每個檔案目標 ≤ 200 行。
- 不抽完全泛型的 `DataTable<T>` — 兩個頁面欄位差異夠多,泛型反而難讀。

**移除/刪除:**
- 各頁面內的 `ListingThumbnail` / `ConnectionThumbnail` 函式 → 換 `DashboardThumbnailCell`
- `rowStyles` (現在三個狀態都是 `bg-white`,沒有差別) → 直接刪
- `listingGridClass` / `connectionGridClass` → 用 `<Table>` 取代

## 邊界情境

- 空字串/null 欄位:顯示 `—`
- 標題、商品名稱很長:`max-w-[28ch]` + `truncate`,hover tooltip(可後續加)
- 0 筆資料:`<EmptyState>` 顯示在表格外(現有 pattern 不變)
- Loading:桌機顯示 `<Skeleton>` 撐 3 row 的表格;手機顯示 3 張 skeleton 卡

## 不做的事 (YAGNI)

- 表頭排序 (sortable header)
- 表內搜尋(已有 Tabs 篩選)
- 分頁(現在 limit 50,夠用)
- Column resizing / column toggle
- 多選 + 批次操作
- 虛擬滾動

未來如果項目數量真的暴增再說。

## 風險

- **shadcn table 是新增的 component**,需要先 commit 一個只加 `table.tsx` 的小 PR,或在同一個 PR 內加入(建議後者,反正只有兩處用)
- **Row click → 編輯頁** 要小心 stopPropagation,測試時需特別驗證點按鈕、連結、縮圖都不會誤觸 row click
- **連線頁面的 `can_wish` flag** 目前用 `(conn as any).can_wish` 取,順手清掉這個 `any`(在重構過程修)

## 測試

- 手動驗證(Run skill):兩個頁面在桌機、平板、手機各看一次;點 row、點按鈕、點縮圖、點商品名連結各驗證一次;每種狀態各一筆資料驗證按鈕組合
- 不寫 E2E(目前專案沒有 E2E 框架)
