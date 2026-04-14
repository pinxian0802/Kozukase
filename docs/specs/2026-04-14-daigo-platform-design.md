# Daigo 代購比價平台：完整設計規格

> **For agentic workers:** This is the master spec for the entire platform. Each Phase below is an independent sub-project with its own implementation plan cycle.

**Goal:** 建立一個代購比價平台，讓買家可以搜尋商品、比較多家代購的價格與條件，並透過 IG / Threads 完成交易。

**Tech Stack:** Next.js 14+ (App Router), TypeScript, tRPC v11, Supabase (PostgreSQL + Auth), Cloudflare R2, Zod, shadcn/ui, Tailwind CSS, Zustand, Supabase Realtime (WebSocket)

---

## 決策記錄

| 問題 | 決策 |
|---|---|
| 專案結構 | 單一 Next.js 專案（非 monorepo） |
| AI 功能（商品比對、自動分類） | 🔜 Phase 9 暫緩，標記為未來迭代 |
| IG / Threads 粉絲數抓取 | 🔜 先手動填寫，標記為未來串接 Meta Graph API |
| 手機 OTP 驗證 | 🔜 先跳過驗證流程，標記為未來加入 |
| 通知機制 | WebSocket（Supabase Realtime）即時推播 |
| 首頁設計 | 搜尋框 + 分類入口 + 最新上架 + 熱門許願 + 連線代購 |
| 環境變數 | `.env` 先留空，開發完成後再填入 |

---

## 標記為未來迭代的功能

以下功能在程式碼中預留介面，但不實作具體邏輯：

1. **手機 OTP 驗證** — `sellers.phone_verified` 欄位保留，成為賣家時跳過驗證步驟直接寫入
2. **IG / Threads 粉絲數自動抓取** — 賣家手動填寫 `ig_follower_count` / `threads_follower_count`，未來改為 Meta Graph API 自動抓取
3. **AI 商品比對** — 上架時搜尋替代，不做 AI 比對
4. **AI 自動分類** — 管理員後台手動分類，不做 AI 批次

---

## 設計系統

| 項目 | 值 |
|---|---|
| Primary Color | `#7C3AED` (紫) |
| Secondary Color | `#A78BFA` (淺紫) |
| CTA Color | `#22C55E` (綠) |
| Background | `#FAF5FF` (米紫) |
| Text Color | `#4C1D95` (深紫) |
| Heading Font | Rubik |
| Body Font | Nunito Sans |
| UI Framework | shadcn/ui + Tailwind CSS |
| Icon Library | Lucide Icons |
| Animation | 200-300ms transitions |
| Breakpoints | 375px / 768px / 1024px / 1440px |

---

## 專案結構

```
daigo/
├── app/
│   ├── layout.tsx                    # Root layout (fonts, providers, metadata)
│   ├── page.tsx                      # 首頁
│   ├── (auth)/
│   │   ├── login/page.tsx            # 登入頁
│   │   └── callback/route.ts         # OAuth callback
│   ├── (buyer)/
│   │   ├── search/page.tsx           # 搜尋結果頁
│   │   ├── products/[id]/page.tsx    # 商品頁（多家代購比較）
│   │   ├── listings/[id]/page.tsx    # Listing 詳細頁
│   │   ├── sellers/[id]/page.tsx     # 賣家主頁
│   │   ├── connections/page.tsx      # 連線代購瀏覽頁
│   │   └── wishes/page.tsx           # 許願清單瀏覽頁（公開）
│   ├── (user)/
│   │   ├── profile/page.tsx          # 個人頁面（收藏、許願、追蹤、評價、通知）
│   │   ├── notifications/page.tsx    # 通知頁
│   │   └── settings/page.tsx         # 設定頁（成為賣家入口）
│   ├── (seller)/
│   │   ├── dashboard/page.tsx        # 賣家後台首頁
│   │   ├── listings/
│   │   │   ├── page.tsx              # Listing 管理列表
│   │   │   ├── new/page.tsx          # 新增 Listing
│   │   │   └── [id]/edit/page.tsx    # 編輯 Listing
│   │   ├── connections/
│   │   │   ├── page.tsx              # 連線管理列表
│   │   │   ├── new/page.tsx          # 新增連線公告
│   │   │   └── [id]/edit/page.tsx    # 編輯連線公告
│   │   └── profile/page.tsx          # 賣家資料設定
│   ├── (admin)/
│   │   ├── layout.tsx                # Admin layout + guard
│   │   ├── products/page.tsx         # 商品管理
│   │   ├── reports/page.tsx          # 檢舉處理
│   │   ├── listings/page.tsx         # Listing 審核
│   │   ├── connections/page.tsx      # 連線審核
│   │   ├── sellers/page.tsx          # 賣家管理（停權）
│   │   └── categories/page.tsx       # 分類管理
│   └── api/
│       └── trpc/[trpc]/route.ts      # tRPC 統一入口
│
├── server/
│   ├── trpc.ts                       # tRPC init + context + middleware
│   ├── root.ts                       # Root router (合併所有子 router)
│   ├── routers/
│   │   ├── auth.ts                   # Auth 相關
│   │   ├── product.ts                # 商品搜尋 + CRUD
│   │   ├── listing.ts                # Listing CRUD + 狀態管理
│   │   ├── seller.ts                 # 賣家資料 + 註冊
│   │   ├── review.ts                 # 評價 + 按讚
│   │   ├── connection.ts             # 連線代購 CRUD
│   │   ├── notification.ts           # 通知查詢 + 標記已讀
│   │   ├── bookmark.ts               # 收藏（商品 + Listing）
│   │   ├── follow.ts                 # 追蹤代購
│   │   ├── wish.ts                   # 許願
│   │   ├── report.ts                 # 檢舉
│   │   ├── upload.ts                 # R2 presigned URL
│   │   └── admin.ts                  # 管理員操作
│   └── db/
│       ├── client.ts                 # Supabase client (service role)
│       ├── queries/                  # 可重用 DB 查詢函式
│       └── types.ts                  # DB 型別（從 Supabase 生成）
│
├── lib/
│   ├── validators/                   # Zod schemas（前後端共用）
│   │   ├── product.ts
│   │   ├── listing.ts
│   │   ├── seller.ts
│   │   ├── review.ts
│   │   ├── connection.ts
│   │   └── common.ts                 # 共用驗證（pagination, etc.）
│   ├── utils/
│   │   ├── search.ts                 # 搜尋正規化（lowercase, kata→hira）
│   │   ├── pagination.ts             # Cursor-based pagination helper
│   │   └── format.ts                 # 格式化工具
│   ├── trpc/
│   │   ├── client.ts                 # tRPC client setup
│   │   ├── server.ts                 # tRPC server caller
│   │   └── provider.tsx              # tRPC + React Query provider
│   ├── supabase/
│   │   ├── client.ts                 # Browser Supabase client (Auth only)
│   │   ├── server.ts                 # Server Supabase client (Auth only)
│   │   └── middleware.ts             # Auth middleware helper
│   └── store/
│       └── ui.ts                     # Zustand UI state
│
├── components/
│   ├── ui/                           # shadcn/ui 元件
│   ├── layout/
│   │   ├── header.tsx                # 全站 Header + 搜尋框
│   │   ├── footer.tsx
│   │   ├── mobile-nav.tsx
│   │   └── sidebar.tsx               # 賣家/管理員 sidebar
│   ├── product/
│   │   ├── product-card.tsx           # 商品卡（搜尋結果用）
│   │   ├── product-search.tsx         # 即時搜尋下拉元件
│   │   └── listing-comparison.tsx     # 多家代購並排比較
│   ├── listing/
│   │   ├── listing-card.tsx
│   │   ├── listing-detail.tsx
│   │   └── listing-form.tsx           # 上架表單
│   ├── seller/
│   │   ├── seller-card.tsx
│   │   └── social-badge.tsx           # IG/Threads 認證標章
│   ├── review/
│   │   ├── review-list.tsx
│   │   ├── review-form.tsx
│   │   └── star-rating.tsx
│   ├── connection/
│   │   ├── connection-card.tsx
│   │   └── connection-form.tsx
│   └── shared/
│       ├── notification-bell.tsx       # Header 通知鈴鐺（Realtime）
│       ├── image-upload.tsx            # 通用圖片上傳元件
│       ├── copy-button.tsx             # 一鍵複製
│       └── report-dialog.tsx           # 檢舉彈窗
│
├── supabase/
│   └── migrations/                    # SQL migration files
│       ├── 001_extensions.sql
│       ├── 002_enums.sql
│       ├── 003_tables.sql
│       ├── 004_indexes.sql
│       ├── 005_triggers.sql
│       └── 006_functions.sql          # search_products RPC
│
├── .env.local                         # 環境變數（先留空）
├── middleware.ts                       # Next.js middleware (auth refresh)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Phase 0：基礎建設

### 0A. 專案初始化

- `create-next-app` with TypeScript + Tailwind + App Router
- 安裝 dependencies：
  ```
  @trpc/server @trpc/client @trpc/react-query @trpc/next
  @tanstack/react-query
  @supabase/supabase-js @supabase/ssr
  zod
  zustand
  sharp
  wanakana (日文片假名⇔平假名)
  @aws-sdk/client-s3 @aws-sdk/s3-request-presigner (R2 compatible)
  ```
- 安裝 devDependencies：`supabase` CLI
- 設定 shadcn/ui（自訂主題色為設計系統色票）
- 設定 Rubik + Nunito Sans 字體（next/font/google）
- `.env.local` 包含以下 keys（值留空）：
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  R2_ACCOUNT_ID=
  R2_ACCESS_KEY_ID=
  R2_SECRET_ACCESS_KEY=
  R2_BUCKET_NAME=
  R2_PUBLIC_URL=
  ```

### 0B. tRPC 架構

- tRPC v11 初始化，整合 App Router
- Context：從 Supabase Auth JWT 解析 user
- Middleware 三層：
  - `publicProcedure` — 任何人
  - `protectedProcedure` — 已登入
  - `sellerProcedure` — 已登入 + 是賣家 + 未停權
  - `adminProcedure` — 已登入 + 是管理員
- React Query provider 設定

### 0C. Supabase 設定

- Browser client（前端 Auth only：登入、登出、refresh token）
- Server client（Auth only：middleware token refresh）
- Service role client（後端 tRPC router 用，直接操作 DB）
- **不使用 RLS**，商業邏輯全在 tRPC middleware + router

### 0D. DB Migration

完整建立所有 tables / enums / indexes / triggers / functions，依照 `database_schema.md` 定義。

包含：
- `pg_trgm` extension
- 所有 enums（listing_status, inactive_reason, connection_status, ended_reason, report_status, review_status, notification_type, product_category）
- 所有 tables（14 張表 + regions 種子資料）
- 所有 indexes
- Triggers：`wish_count`, `avg_rating`, `review_count`, `like_count` 快取更新
- `search_products` RPC function
- Count-limit triggers：Listing 25 上限、Connection 5 上限、Wish 20 上限、圖片 5 張上限

### 0E. R2 圖片上傳

- `upload.getPresignedUrl` tRPC endpoint
  - 接受 `purpose`（product / listing / connection / avatar）、`contentType`、`fileSize`
  - 驗證檔案型別（JPEG, PNG, WebP）、大小（≤5MB）
  - 回傳 presigned PUT URL + r2_key
- `upload.confirmUpload` tRPC endpoint
  - 接收 r2_key，確認上傳成功，寫入對應 table
- Image processing：上傳後 server-side 用 Sharp 壓縮為 WebP、長邊 ≤ 1920px
  - 注意：因為是 presigned URL 直傳 R2，壓縮需在前端做或用 R2 Worker
  - **調整方案**：前端上傳前用 browser-image-compression 壓縮 + 轉 WebP，再上傳至 R2

### 0F. 共用工具

- Cursor-based pagination helper（encode/decode cursor, 統一回傳格式）
- 搜尋正規化 util（`normalizeSearchText`：英文 lowercase + 日文片假名→平假名）
- Zod 共用 schemas（pagination input, id param, etc.）

---

## Phase 1：使用者系統

### 1A. Auth

- Supabase Auth 設定 Google + Email provider
- `/login` 頁面（Google OAuth button + Email magic link）
- OAuth callback route handler
- `middleware.ts`：refresh session token
- tRPC context 從 cookie 解析 user session

### 1B. Profiles

- 新用戶首次登入時自動建立 `profiles` 記錄（在 tRPC context 或 auth callback 處理）
- 個人頁面：顯示名稱、頭像
- 頭像上傳（R2）

### 1C. 成為賣家

- 個人設定頁「成為賣家」按鈕
- 表單：賣家名稱、手機號碼（僅記錄，不驗證 🔜）、代購地區（多選）
- 寫入 `sellers` + `seller_regions`
- `phone_verified` 預設為 `true`（🔜 未來加入 OTP 後改為驗證流程）

### 1D. 社群連結

- 賣家資料頁可填寫 IG handle / Threads handle
- 手動填寫粉絲數（🔜 未來改為 API 自動抓取）
- 填寫後 `is_social_verified = true`、更新 `social_connected_at`
- 顯示認證標章 component

---

## Phase 2：商品目錄與搜尋

### 2A. 商品 CRUD

- `product.create`：名稱（必填）、品牌（選填）
- 商品圖片上傳 → `product_images` table
- `product.getById`：商品詳細資料

### 2B. 商品搜尋

- `product.search`（上架/許願用）
  - 即時搜尋，debounce 300ms
  - 呼叫 `search_products` RPC
  - 觸發門檻：中/韓文 ≥1 字、純英數 ≥2 字元
  - 回傳最多 20 筆（名稱 + id）
- `product.browse`（買家搜尋用）
  - 僅回傳有 active Listing 的商品
  - 支援篩選：category, region, price range, shipping_days, social_verified
  - 支援排序：最新上架 / 價格最低
  - Cursor-based 分頁
  - URL params 驅動：`/search?q=&category=&region=&sort=`

### 2C. 分類系統

- 8 個 enum 值
- 管理員後台手動設定分類
- 🔜 未來加入 AI 自動分類

---

## Phase 3：Listing（代購上架）

### 3A. Listing CRUD

- `listing.create`
  - 第一步：搜尋 / 新增商品
  - 第二步：填寫上架資訊（圖片、價格、規格、備註、貼文連結、出貨天數、截止時間）
  - 可存為草稿
- `listing.update`：編輯所有欄位
- `listing.delete`：僅刪除草稿
- 離開頁面提示儲存草稿（beforeunload）

### 3B. Listing 圖片

- 最多 5 張，支援排序（drag & drop sort_order）
- R2 presigned URL 上傳
- 前端壓縮 + WebP 轉換

### 3C. 規格系統

- JSONB `specs` 欄位
- 固定類型：顏色、尺寸、口味、容量、材質、款式、重量
- 或自訂類型
- 每個規格可填選項 or 勾「都有」（`is_all: true`）
- 支援新增多組規格

### 3D. Listing 狀態機

```
draft ──(發布)──► active
active ──(手動下架)──► inactive (self)
active ──(到期)──► inactive (expired)     ← Cron 排程檢查
active ──(管理員下架)──► inactive (admin)
active ──(商品被移除)──► inactive (product_removed)
inactive (self/expired) ──(重新上架)──► active
inactive (admin) ──(重新上架申請)──► pending_approval
pending_approval ──(管理員通過)──► active
```

### 3E. 賣家後台

- Listing 管理列表：依狀態篩選（draft / active / inactive / pending_approval）
- 各狀態可用操作：編輯、下架、重新上架、繼續填寫草稿
- 顯示 25 個上限使用量

---

## Phase 4：買家體驗

### 4A. 首頁

- **Hero 區塊**：大搜尋框 + 熱門搜尋關鍵字建議
- **分類入口**：8 大類 icon grid
- **最新上架**：最新 active Listing 的商品卡列表（橫向捲動）
- **熱門許願**：許願人數最多的商品（吸引賣家上架）
- **連線代購**：目前進行中的連線公告預覽
- **成為賣家 CTA**：引導註冊

### 4B. 搜尋結果頁 `/search`

- URL params 控制所有狀態（可分享、瀏覽器上一頁）
- 左側篩選 sidebar（mobile: bottom sheet）
  - 商品分類（checkboxes）
  - 代購地區（checkboxes）
  - 價格範圍（range input）
  - 出貨天數（range input）
  - 只看有社群連結的賣家（toggle）
- 排序切換：最新上架 / 價格最低
- 商品卡 grid（目錄圖片 + 商品名稱 + 許願人數 + 最低價格）
- Cursor-based infinite scroll

### 4C. 商品頁 `/products/[id]`

- 商品資訊（名稱、品牌、分類、目錄圖片）
- 許願按鈕 + 許願人數
- 收藏商品按鈕
- **多家代購並排比較表**：
  - 各賣家 Listing 卡片（賣家名稱 + 認證標章 + 第一張 Listing 圖片 + 價格 + 出貨天數 + 規格摘要）
  - 依價格排序
  - 點擊進入 Listing 詳細頁

### 4D. Listing 詳細頁 `/listings/[id]`

- Listing 圖片輪播
- 價格 or 「私訊報價」
- 規格詳細列表
- 備註
- 出貨天數
- 收藏 Listing 按鈕
- 賣家資訊區（名稱、評價星等、IG/Threads + 粉絲數、認證標章）
- **一鍵複製詢問語法**（預設模板：「你好，我想詢問 [商品名稱] 的代購...」）
- 跳轉 IG / Threads 原始貼文按鈕
- 檢舉按鈕

### 4E. 賣家主頁 `/sellers/[id]`

- 基本資料：名稱、加入時間、代購地區
- IG / Threads 帳號 + 粉絲數 + 認證標章（有連結才顯示）
- 追蹤按鈕
- 評價區：整體星等 + 評價列表（cursor 分頁）+ 賣家回覆
- 上架商品：所有 active Listing
- 連線公告：目前進行中的連線

---

## Phase 5：社交功能

### 5A. 收藏系統

- 收藏商品（product_bookmarks）
- 收藏 Listing（listing_bookmarks）
- 個人頁面查看 + 取消收藏
- 商品頁 / Listing 頁顯示收藏狀態（已登入用戶）

### 5B. 追蹤代購

- Follow / Unfollow toggle
- 個人頁面查看追蹤列表
- 追蹤的賣家上架新商品時觸發通知（Phase 6）

### 5C. 許願系統

- 許願 / 取消 toggle
- 每人每商品限一次
- 每人最多 20 個許願（DB trigger + 應用層雙重驗證）
- `wish_count` 由 trigger 維護
- 個人頁面查看許願清單
- 公開許願清單瀏覽頁（依許願人數排序）
- 商品被移除時自動取消許願 + 通知

### 5D. 評價系統

- 1-5 星 + 文字（選填）
- 同一買家對同一賣家僅一則（UNIQUE constraint）
- 賣家可回覆每則評價
- 按讚 / 取消按讚（每人每則一次）
- `like_count` 由 trigger 維護
- `avg_rating` / `review_count` 由 trigger 維護
- 評價檢舉（被檢舉後照常顯示）
- 評價狀態：visible / hidden（管理員控制）

---

## Phase 6：通知系統

### 6A. 通知核心

- `notifications` table，13 種 type
- `payload` JSONB 彈性資料（依 type 不同內容）
- Supabase Realtime 訂閱 `notifications` table
  - 當 `recipient_id = current_user` 有新 INSERT 時即時推送
  - 前端 notification bell 即時更新未讀數

### 6B. 通知觸發點

在各 tRPC router 操作完成時同步寫入 `notifications`：

| 觸發點 | notification type | 寫入位置 |
|---|---|---|
| 有人留評價 | `review_received` | `review.create` |
| 評價被按讚 | `review_liked` | `review.like` |
| Listing 被管理員下架 | `listing_removed_by_admin` | `admin.removeListing` |
| Listing 重新上架通過 | `listing_republish_approved` | `admin.approveListing` |
| 連線被管理員結束 | `connection_removed_by_admin` | `admin.removeConnection` |
| 連線重新上線通過 | `connection_republish_approved` | `admin.approveConnection` |
| 商品被移除（Listing受影響） | `product_removed` | `admin.removeProduct` |
| 自己新增的商品被移除 | `product_removed_creator` | `admin.removeProduct` |
| 帳號被處置 | `account_action_taken` | `admin.suspendSeller` |
| 許願商品有新 Listing | `new_listing_for_wish` | `listing.create`（發布時） |
| 追蹤的賣家新上架 | `followed_seller_new_listing` | `listing.create`（發布時） |
| 許願商品被移除 | `wish_product_removed` | `admin.removeProduct` |
| 收藏商品被移除 | `bookmarked_product_removed` | `admin.removeProduct` |

### 6C. 通知頁面

- 通知列表（cursor 分頁）
- 標記已讀（單則 / 全部）
- Header notification bell（未讀數 badge + Realtime 更新）

---

## Phase 7：連線代購

### 7A. 連線公告 CRUD

- `connection.create`：國家（必填）、地區（選填）、期間（必填）、說明（選填）、圖片（選填，最多5張）
- `connection.update`：編輯所有欄位
- 5 個上限（所有狀態合計）

### 7B. 連線狀態機

```
active ──(到期)──► ended (expired)       ← Cron 排程檢查
active ──(手動結束)──► ended (self)
active ──(管理員結束)──► ended (admin)
ended (admin) ──(重新申請)──► pending_approval
pending_approval ──(管理員通過)──► active
```

### 7C. 連線瀏覽頁 `/connections`

- 篩選：連線國家、連線期間
- 連線卡片 grid（國家 + 地區 + 期間 + 說明 + 賣家資訊）
- 點擊進入賣家主頁

---

## Phase 8：檢舉與管理後台

### 8A. 檢舉系統

- 檢舉對象 4 種：Listing / 評價 / 連線 / 賣家帳號
- 各有不同檢舉原因選項
- CHECK 約束確保恰好一個 FK 非 null
- 被檢舉內容照常顯示，不通知被檢舉方

### 8B. 管理員後台

- **商品管理**：列表 + 移除（軟刪除 `is_removed`）
  - 移除後：所有 Listing inactive (product_removed) + 通知賣家 + 許願自動取消 + 通知許願者 + 通知收藏者
- **商品主圖管理**：查看每個商品下所有候選圖 → 設定 `catalog_image_id`
- **分類管理**：設定 / 修改商品分類
- **檢舉處理**：待審佇列、審核（resolve / dismiss）、填寫 admin_note
- **Listing 審核**：`pending_approval` 佇列、通過 / 駁回
- **連線審核**：`pending_approval` 佇列、通過 / 駁回
- **強制下架 Listing**：填寫下架原因 → inactive (admin) + 通知
- **強制結束連線**：填寫結束原因 → ended (admin) + 通知
- **賣家管理**：查看賣家列表、停權 / 解除停權

### 8C. 帳號停權

- 停權時：
  - `is_suspended = true`
  - 所有 active + pending Listing → inactive (admin)
  - 所有 active + pending Connection → ended (admin)
  - 該賣家所有公開頁面不可見
  - 追蹤者不收通知
- 解除停權時：
  - `is_suspended = false`
  - Listing / Connection 不自動恢復，需賣家手動重新申請

---

## Cron 排程

| 排程 | 頻率 | 功能 |
|---|---|---|
| Listing 到期下架 | 每小時 | 掃描 `expires_at < now()` 的 active Listing → inactive (expired) |
| 連線到期結束 | 每天凌晨 | 掃描 `end_date < today()` 的 active Connection → ended (expired) |

用 Vercel Cron Functions + API Route 實作。

---

## 環境變數完整列表

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=

# App
NEXT_PUBLIC_APP_URL=
CRON_SECRET=
```

---

## 資料流圖

### 一般 API 呼叫
```
Browser
  → tRPC Client (React Query)
    → POST /api/trpc/[procedure]
      → tRPC Router (auth middleware 驗證 JWT)
        → Supabase PostgreSQL (service role key)
      ← JSON response
    ← React Query cache
  ← UI 更新
```

### 圖片上傳
```
Browser
  → 前端壓縮（browser-image-compression → WebP, ≤1920px, ≤5MB）
  → tRPC upload.getPresignedUrl（取得 R2 PUT URL）
  → 直接 PUT 至 R2
  → tRPC upload.confirmUpload（r2_key → DB 記錄）
```

### 即時通知
```
Server (tRPC router)
  → INSERT INTO notifications
    → Supabase Realtime（WebSocket broadcast）
      → Browser（Supabase Realtime client 訂閱）
        → 更新 notification bell badge
```
