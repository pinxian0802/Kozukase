# Kozukase 平台總覽

## 一、系統定位

Kozukase 是一個代購媒合平台，連接需要代購服務的買家與提供代購服務的賣家。平台設有管理員角色負責內容審核與帳號管理。

---

## 二、使用者角色

### 買家（Buyer）
已登入但尚未成為賣家的使用者。

**可執行的操作：**
- 搜尋與瀏覽商品、代購上架商品
- 許願商品（最多 20 個）
- 收藏商品與代購上架商品
- 追蹤賣家
- 對賣家留評價（一賣家一評價）
- 對評價按讚
- 瀏覽連線公告
- 檢舉不當內容（商品、評價、連線、賣家）
- 查看通知

### 賣家（Seller）
完成「成為賣家」流程的使用者。

**必填資訊：**
- 賣家名稱
- 手機號碼
- 至少一個代購地區

**選填資訊：**
- 頭貼（`avatar_url`，獨立於個人 profile 頭貼）
- 自我介紹（`bio`）

**可執行的操作（含買家所有權限，另加）：**
- 上架代購商品（最多 25 個）
- 發布連線公告（最多 5 個）
- 管理自己的代購與連線（編輯、下架、重新上架）
- 回覆買家評價
- 連接社群帳號（Instagram / Threads）

**限制：**
- 被停權後所有操作受限，上架商品與連線自動下架

### 管理員（Admin）
在 Supabase auth `app_metadata` 中具有 `admin` 角色的使用者。

**可執行的操作：**
- 搜尋與編輯所有商品（名稱、品牌、分類、型號、封面圖片）
- 軟刪除商品（連帶下架相關代購、取消許願、通知相關使用者）
- 審核待審核的代購與連線（核准 / 下架）
- 停權 / 解除停權賣家
- 管理所有使用者（指派 / 移除管理員）
- 處理檢舉報告（已解決 / 已駁回）

---

## 三、主要功能模組

### 商品（Products）

商品是平台的核心資料單位，由任何已登入的使用者建立，賣家在此基礎上新增代購上架商品。

**欄位：**
- 名稱（必填）
- 品牌（選填，外鍵至 `brands` 資料表）
- 分類：時尚穿搭、美妝保養、保健品、食品零食、3C電器、生活雜貨、運動戶外、公仔玩具、書籍文具、寵物用品、文化紀念品、汽機車用品、母嬰用品、珠寶首飾、其他
- 型號（選填）
- 封面圖片（選填）
- 搜尋別名（選填，`aliases text[]`，由管理員維護，用於多語言搜尋）

**規則：**
- 管理員可軟刪除商品，刪除時：
  - 所有相關代購上架商品自動下架（原因：`product_removed`）；賣家可在編輯頁重新選擇有效商品後重新送出，進入 `pending_approval` 待審
  - 通知受影響的賣家（`product_removed`）
  - 自動取消所有對此商品的許願（不另發通知）
- 商品的許願計數（`wish_count`）透過資料庫觸發器自動維護

**搜尋：**
- 兩個搜尋入口共用相同邏輯（買家瀏覽頁、賣家新增代購時的商品搜尋）
- 使用 PostgreSQL `pg_trgm` 模糊比對，支援錯別字容錯（短字串效果有限）
- 搜尋欄位 `search_text` 由觸發器自動維護，內容為 `katakana_to_hiragana(lower(name) || ' ' || lower(array_to_string(aliases, ' ')))`；片假名統一轉為平假名，使「ソニー」與「そにー」可互相匹配
- 品牌名稱（`brands.name`）亦納入搜尋比對，同樣套用片假名正規化
- 可依分類、價格範圍、出貨天數、社群驗證、賣家地區篩選
- 買家瀏覽頁的「代購」分頁額外可篩選「有現貨」（`listings.is_in_stock`）
- 排序：賣家搜尋依相似度 → 許願數；買家瀏覽依建立時間降序或價格升序
- 買家瀏覽採頁碼分頁，每頁可選 10 / 20 / 50 筆

**多語言搜尋：**
- 管理員可在商品編輯頁設定 `aliases`（如將「資生堂」的 aliases 設為 `["Shiseido", "しせいどう"]`）
- 別名會自動納入 `search_text`，買家搜尋任何語言皆可找到對應商品
- 純演算法無法推導跨語言對應，別名須由管理員人工維護

---

### 代購上架商品（Listings）

賣家針對特定商品發布的代購服務。

**狀態流程：**
```
draft ──────────────► active ◄──── pending_approval
                         │
                         ▼
                      inactive
```

**狀態說明：**

| 狀態 | 說明 |
|------|------|
| `draft` | 草稿，尚未公開 |
| `active` | 上架中，買家可見 |
| `inactive` | 已下架 |
| `pending_approval` | 待管理員審核（被管理員下架後重新申請） |

**下架原因（`inactive_reason`）：**

| 原因 | 說明 |
|------|------|
| `self` | 賣家自行下架 |
| `admin` | 管理員下架 |
| `product_removed` | 商品被刪除導致；需在編輯頁重選商品後重新送出（→ `pending_approval`） |
| `expired` | 到期下架（機制保留，尚未實作） |

**重新上架規則：**
- 閘門以「目前指向的商品是否仍被移除」為準：商品仍被移除時拋出錯誤，要求先重選商品
- 原因為 `self` / `expired` → 直接變為 `active`
- 原因為 `admin` / `product_removed` → 進入 `pending_approval`，需管理員審核後方可上架
- `product_removed`：賣家於編輯頁重選有效商品（搜尋現有或新增）後，按「重新送出審核」即更新商品並重送

**上架必填欄位：**
- 貼文連結
- 出貨天數
- 價格，或勾選「私訊報價（`is_price_on_request`）」

**圖片：** 必填，至少 1 張，最多 5 張，支援排序（上架時驗證，儲存草稿不擋）

**上架時自動通知：**
- 許願此商品的買家（`new_listing_for_wish`）

**數量上限：** 每位賣家最多 25 個，由資料庫觸發器強制執行

---

### 連線公告（Connections）

賣家在特定地區、特定時段提供即時代購服務的公告。

**狀態流程：**
```
active ◄──── pending_approval
   │
   ▼
 ended
```

**下架原因（`ended_reason`）：**

| 原因 | 說明 |
|------|------|
| `self` | 賣家自行結束 |
| `admin` | 管理員結束 |
| `expired` | 到期結束（機制保留，尚未實作） |

**重新申請規則：** 與代購上架商品相同，`admin` 原因需重新審核。

**欄位：**
- 地區（必填，外鍵至 `regions`）
- 開始 / 結束日期（必填）
- 圖片（必填，至少 1 張，最多 5 張）
- 地點（選填，`locations text[]`，最多 10 個，如「稻荷神社」、「上野動物園」；列表顯示最多 2 個，超過顯示 `+N`）
- 描述（選填，最多 500 字）
- 計費方法（選填，最多 500 字）
- 品牌（選填，多選，外鍵至 `brands`）

**瀏覽與搜尋：**
- 買家瀏覽頁可依地區、地點關鍵字、品牌、連線日期區間、可許願、提供付款方式、社群驗證篩選
- 地點關鍵字輸入後按 Enter（或離開輸入框）才提交，比對 `connections.locations_text` 鏡像欄位（由 trigger 攤平 `locations text[]` 維護，技術細節見 `docs/notes/postgrest-column-cast-pitfall.md`）
- 全站搜尋（header `q`）會同時比對 `title`、`description`、`locations_text`
- 社群驗證篩選只顯示已連結社群帳號（`sellers.is_social_verified`）的賣家連線

**數量上限：** 每位賣家最多 5 個，由資料庫觸發器強制執行

**預設地區：** 日本、韓國、美國、英國、法國、德國、義大利、澳洲、泰國、其他

---

### 評價系統（Reviews）

**規則：**
- 同一買家對同一賣家只能留一筆評價（資料庫唯一約束）
- 評分 1–5 星（必填），評論文字選填
- 賣家可回覆評價，記錄回覆時間

**狀態：** `visible`（預設）/ `hidden`

**賣家統計（自動計算）：**
- 平均評分（`avg_rating`）
- 評價數（`review_count`）
- 僅計算 `status = 'visible'` 的評價
- 透過資料庫觸發器在評價新增 / 刪除 / 更新時自動更新

**按讚：**
- 同一買家對同一評價只能按讚一次
- 讚數透過觸發器自動維護

---

### 許願系統（Wishes）

- 同一買家對同一商品只能許願一次
- 每位買家最多許願 20 個商品（資料庫觸發器強制）
- 商品的 `wish_count` 透過觸發器自動維護
- 新上架商品發布時，許願該商品的買家會收到通知

---

### 收藏系統（Bookmarks）

分兩類，無數量限制：
- **商品收藏（`product_bookmarks`）**：收藏商品本身
- **代購收藏（`listing_bookmarks`）**：收藏特定代購上架商品

---

### 追蹤系統（Follows）

- 同一買家對同一賣家只能追蹤一次

---

### 檢舉系統（Reports）

**可檢舉對象：**
- 代購上架商品（`listing_id`）
- 評價（`review_id`）
- 連線公告（`connection_id`）
- 賣家帳號（`seller_id`）

每份檢舉只能指向一個對象（資料庫 CHECK 約束）。

**狀態流程：** `pending` → `resolved` / `dismissed`

管理員可附加備註，系統記錄解決者與解決時間。

---

### 通知系統（Notifications）

所有通知儲存在 `notifications` 表，包含 `type`、`payload（JSONB）`、`is_read`。

**完整通知列表（共 8 種）：**

| 通知類型 | 接收者 | 觸發條件 |
|---------|--------|---------|
| `review_received` | 賣家 | 買家對賣家留評價 |
| `listing_removed_by_admin` | 賣家 | 管理員下架某筆代購上架 |
| `listing_republish_approved` | 賣家 | 管理員核准代購重新上架 |
| `connection_removed_by_admin` | 賣家 | 管理員結束某條連線 |
| `connection_republish_approved` | 賣家 | 管理員核准連線重新發佈 |
| `product_removed` | 相關賣家 | 商品被移除導致代購自動下架 |
| `account_action_taken` | 賣家 | 賣家被停權 |
| `new_listing_for_wish` | 許願買家 | 許願商品有新代購上架 |

**通知顯示（標題 + 內文）：**

通知頁（`/notifications`）以「標題 + 內文」呈現，由前端 `getNotificationContent(type, payload)` 統一產生。商品／代購／連線相關通知在發送當下即把名稱寫入 `payload`（凍結當下名稱，避免來源被刪後查無），**標題動態帶上名稱**，內文說明原因與後續處置。

| type | 標題範例 | payload 名稱來源 |
|------|---------|-----------------|
| `connection_removed_by_admin` | 「澳洲代購」已被中止 | `connection_title` ＋ `admin_note`（原因） |
| `connection_republish_approved` | 「澳洲代購」已重新發佈 | `connection_title` |
| `listing_removed_by_admin` | 「SK-II」代購已被下架 | `product_name` ＋ `admin_note`（原因） |
| `listing_republish_approved` | 「SK-II」代購已重新上架 | `product_name` |
| `product_removed` | 「橘子」已被移除，相關代購已下架 | `product_name` |
| `account_action_taken` | 你的帳號已被停權 | `reason`（原因） |
| `review_received` | 你收到一則新評價（5 星） | `rating` |
| `new_listing_for_wish` | 「SK-II」有新代購上架 | `product_name` |

- 下架／停權類內文附客服信箱 `support@kozukase.com`（可點 mailto）。
- 改動前發出、`payload` 無名稱的舊通知優雅降級為通用標題（不帶名稱）。
- 導覽列鈴鐺點擊後以下拉選單顯示最新 5 則通知（僅標題＋時間），底部「查看更多」導向 `/notifications` 完整頁面。共用 `components/shared/notification-content.tsx` 的 `getNotificationContent`。

---

## 四、主要操作流程

### 新使用者入職

1. 使用 Email / Google / GitHub 登入
2. 系統自動建立 `profiles` 記錄
3. 進入入職流程（Onboarding）
4. 設定 username（3–20 字元，小寫英文 + 數字，全平台唯一）與 display_name
5. 可選：上傳頭像
6. 完成後進入首頁

---

### 買家成為賣家

1. 進入「成為賣家」頁面
2. 填寫：賣家名稱、手機號碼、至少一個代購地區
3. 送出後系統建立 `sellers` 與 `seller_regions` 記錄
4. 導向賣家後台

---

### 賣家上架代購商品

**步驟一：選擇或建立商品**

- **搜尋現有商品**：輸入名稱，從搜尋結果中選取
- **建立新商品**：填寫名稱（必填）、品牌（選填，可直接新增）、型號（選填）、分類（選填）、至少上傳一張圖片

**步驟二：填寫代購詳情**
- 貼文連結（必填）
- 出貨天數（必填）
- 價格，或勾選「私訊報價」（必填擇一）
- 規格、備註、過期日期、代購圖片（選填）

**步驟三：發布**
- 狀態設為 `active`
- 自動通知許願此商品的買家

或選擇「儲存草稿」，狀態設為 `draft`，可隨時繼續編輯。

---

### 賣家發布連線公告

1. 填寫地區、開始日期、結束日期（必填）
2. 上傳至少一張圖片（必填）
3. 填寫地點（可新增多個 tag，如「稻荷神社」）、描述、計費方法、品牌（多選，可直接新增）（選填）
4. 發布後狀態為 `active`，公開顯示於連線瀏覽頁；買家可依地點關鍵字搜尋

---

### 賣家管理代購 / 連線

| 操作 | 條件 | 結果 |
|------|------|------|
| 下架 | 狀態為 `active` | → `inactive`（reason: `self`） |
| 重新上架 | reason 為 `self` | → `active` |
| 重新上架 | reason 為 `admin` | → `pending_approval` |
| 重新上架 | reason 為 `product_removed` | 拋出錯誤 |
| 刪除 | 狀態為 `draft` | 永久刪除 |

---

### 管理員操作流程

#### 審核待審核代購 / 連線
1. 進入 `/admin/listings` 或 `/admin/connections`
2. 查看待審核清單
3. 核准 → 狀態變 `active`，賣家收到通知
4. 下架 → 狀態變 `inactive/ended`（reason: `admin`），賣家收到通知

#### 刪除商品
1. 進入 `/admin/products`，搜尋商品
2. 點擊刪除
3. 系統自動：
   - 軟刪除商品
   - 下架所有相關代購（reason: `product_removed`）
   - 通知受影響的賣家（`product_removed`）
   - 取消所有許願（不另發通知）

#### 停權賣家
1. 進入 `/admin/sellers`，找到目標賣家
2. 點擊停權並填寫原因
3. 系統自動：
   - 標記 `is_suspended = true`
   - 下架所有代購（reason: `admin`）
   - 結束所有連線（reason: `admin`）
   - 通知賣家
   - 搜尋結果中隱藏該賣家

---

## 五、頁面路由結構

### 公開頁面（未登入可訪問）
| 路由 | 說明 |
|------|------|
| `/` | 首頁（頂部橫式 banner 圖片輪播主視覺，自動輪播＋圓點＋左右箭頭，圖片未上前以品牌色漸層佔位；商品分類 + 熱門商品橫滑 + 即將出發連線橫滑 + 成為賣家 CTA；async RSC，熱門商品依 `product_views` 排序，無瀏覽以最新遞補；任一排無資料則不渲染。首頁主視覺不再含搜尋列，搜尋入口改由 Header 提供） |
| `/search` | 商品搜尋與瀏覽（篩選狀態由 nuqs 管理，URL 即 state，取代原手寫 useSearchParams + 樂觀鏡像） |
| `/connections` | 連線公告瀏覽（篩選狀態由 nuqs 管理，URL 即 state，沿用 /search 模式；location 文字框用 replace+throttle） |
| `/sellers/[id]` | 賣家詳情頁 |
| `/products/[id]` | 商品詳情頁 |
| `/listings/[id]` | 代購詳情頁 |

### 已登入買家
| 路由 | 說明 |
|------|------|
| `/favorites` | 我的收藏（商品、代購、連線） |
| `/account` | 帳號設定 |
| `/notifications` | 通知中心 |
| `/become-seller` | 申請成為賣家 |

### 已登入賣家（額外）
| 路由 | 說明 |
|------|------|
| `/dashboard` | 賣家後台總覽 |
| `/dashboard/listings` | 代購管理 |
| `/dashboard/listings/new` | 新增代購 |
| `/dashboard/listings/[id]/edit` | 編輯代購 |
| `/dashboard/connections` | 連線管理 |
| `/dashboard/connections/new` | 新增連線 |
| `/dashboard/connections/[id]/edit` | 編輯連線 |
| `/dashboard/profile` | 賣家資訊編輯 |

### 管理員
| 路由 | 說明 |
|------|------|
| `/admin` | 管理總覽 |
| `/admin/users` | 使用者管理 |
| `/admin/products` | 商品管理 |
| `/admin/listings` | 代購審核 |
| `/admin/connections` | 連線審核 |
| `/admin/sellers` | 賣家管理 |
| `/admin/reports` | 檢舉管理 |
| `/admin/banners` | 首頁輪播管理：上傳/排序(拖曳)/上下架橫式 banner;資料存 `home_banners`，首頁由 `banner.listActive` 讀取、無上架資料則隱藏 hero |

---

## 六、業務限制彙整

| 項目 | 限制 | 強制位置 |
|------|------|---------|
| 賣家代購數 | 最多 25 個 | 資料庫觸發器 |
| 賣家連線數 | 最多 5 個 | 資料庫觸發器 |
| 買家許願數 | 最多 20 個 | 資料庫觸發器 |
| 代購圖片數 | 最多 5 張 | 資料庫觸發器 |
| 連線圖片數 | 最多 5 張 | 資料庫觸發器 |
| 評價唯一性 | 一買家一賣家一評價 | 資料庫唯一約束 |
| 許願唯一性 | 一買家一商品一許願 | 資料庫唯一約束 |
| 追蹤唯一性 | 一買家一賣家一追蹤 | 資料庫唯一約束 |
| 按讚唯一性 | 一買家一評價一讚 | 資料庫唯一約束 |
| Username | 全平台唯一 | 資料庫唯一約束 |

---

## 七、自動計算欄位

以下欄位由資料庫觸發器自動維護，不需手動更新：

| 欄位 | 資料表 | 觸發時機 |
|------|--------|---------|
| `wish_count` | `products` | `wishes` 新增 / 刪除時 |
| `search_text` | `products` | `products` 新增 / 更新 `name` 或 `aliases` 時 |
| `avg_rating` | `sellers` | `reviews` 新增 / 刪除 / 更新時 |
| `review_count` | `sellers` | `reviews` 新增 / 刪除 / 更新時 |
| `like_count` | `reviews` | `review_likes` 新增 / 刪除時 |
| `updated_at` | 多個資料表 | 記錄更新時 |

### 瀏覽記錄(Analytics views)

| 資料表 | 寫入時機 | 用途 |
|--------|---------|------|
| `listing_views` | 開啟 `/listings/[id]` 時(非擁有者、同 session 去重) | 賣家後台「刊登瀏覽」、聚合分析 |
| `product_views` | 開啟 `/products/[id]` 時(非建立者、同 session 去重) | 首頁「熱門商品」排序、賣家後台「商品瀏覽」 |
| `connection_views` | 開啟 `/connections/[id]` 時(非賣家本人、同 session 去重) | 賣家後台「連線瀏覽」 |
| `profile_views` | 開啟 `/sellers/[id]` 時(非本人、同 session 去重) | 賣家後台「主頁訪客」 |
| `social_link_clicks` | 點擊 IG / Threads 連結時 | 賣家後台「IG / Threads 點擊」 |

賣家後台 `/dashboard` 數據總覽以 `analytics.getSellerStats` 聚合上列計數,提供 7 / 30 / 90 天視窗與環比趨勢。

---

## 八、E2E 測試帳號

Playwright e2e 測試使用三個角色隔離的專用帳號（密碼統一存於 `E2E_PASSWORD`）：

| 角色 | 環境變數 | 帳號 | 說明 |
|------|----------|------|------|
| 買家 | `E2E_BUYER_EMAIL` | `e2e-buyer@kozukase.test` | 純買家，非賣家／管理員 |
| 賣家 | `E2E_SELLER_EMAIL` | `e2e-seller@kozukase.test` | 賣家，代購地區為日本 |
| 管理員 | `E2E_ADMIN_EMAIL` | `e2e-admin@kozukase.test` | `app_metadata.role=admin` |

測試打正式 Supabase，所有測試資料以 `[E2E]` 前綴命名；各測試自我清理，`tests/global.teardown.ts` 為最後防線會掃除殘留 `[E2E]%` 資料。詳見 `tests/README.md`。

## 九、錯誤監控（Sentry）

以官方 `@sentry/nextjs` 整合錯誤追蹤 + 效能監控 + Session Replay，Sentry 組織 `pinxian-chiang` / 專案 `kozukase`。

**設定檔（Next.js 16 instrumentation 機制，皆在 repo root）：**

| 檔案 | 用途 |
|------|------|
| `instrumentation-client.ts` | 瀏覽器端 init、Session Replay、取樣率、`onRouterTransitionStart` |
| `sentry.server.config.ts` / `sentry.edge.config.ts` | Node / Edge runtime init |
| `instrumentation.ts` | 註冊 server/edge config + `onRequestError`（捕捉 RSC / Server Action / route handler 錯誤）|
| `app/global-error.tsx` | 全域 React 錯誤邊界 |
| `next.config.ts` | `withSentryConfig` 包裝，build 時上傳 source map |

**捕捉範圍與過濾：**

- 前端 render 錯誤、未處理 rejection、Server 端錯誤皆自動捕捉。
- tRPC 錯誤需特別處理：`fetchRequestHandler` 會吃掉錯誤自行回 500，**不會**觸發 `onRequestError`，故在 `app/api/trpc/[trpc]/route.ts` 的 `onError` 手動 `captureException`。流程控制用的預期錯誤（`UNAUTHORIZED`、`FORBIDDEN`、`NOT_FOUND`、`BAD_REQUEST`、`CONFLICT`、`TOO_MANY_REQUESTS`、`PARSE_ERROR`）列白名單**不送** Sentry，避免雜訊；其餘（含 `INTERNAL_SERVER_ERROR`）才送。
- route handler 回應後 Sentry 來不及送出，捕捉後需 `await Sentry.flush()` 才回傳 response。

**取樣 / 隱私：** `tracesSampleRate` 0.1；一般 session 不錄（`replaysSessionSampleRate` 0），出錯才回溯錄製（`replaysOnErrorSampleRate` 1.0）；Session Replay 全程 `maskAllText` + `blockAllMedia`。

**環境變數：** `NEXT_PUBLIC_SENTRY_DSN`（client+server 共用）、`SENTRY_AUTH_TOKEN`（source map 上傳，敏感值，僅 `.env.local` 與 Vercel，不進 git）。通知走 Sentry 後台 Email，無程式碼。

## 十、前端 Design System

從 2026-05-21 啟動 Design System v1 改造（**規格：`docs/specs/2026-05-21-design-system-plan.md`，hex 對照表：`docs/design-system/migration.md`**）。

**架構：** `app/globals.css` 採三層 token 結構：
- **Raw scale**：`--brand-50/100/300/500/700/900`（teal）+ `--neutral-0~1000`（中性 12 階）+ `--success/warning/info-*`
- **Semantic**：`--surface-{page,card,overlay,muted}` / `--border-{soft,strong}` / `--text-{strong,muted,faint,inverse}` / `--cta` / `--brand`
- **Legacy shadcn**：既有 `--background` `--primary` `--card` 等保留，未來逐步成 alias

**Tailwind 對應：** 所有 token 透過 `@theme inline` 暴露成 utility，例：`bg-surface-card`、`text-text-strong`、`border-border-soft`、`bg-brand-500`。

**進度（2026-05-21）：** Phase 1–7 全數完成。硬碼 hex 用量 300+ → 20（剩餘均為刻意保留：accent palette、Google OAuth 服務色、avatar gradient）。

**完整文件：**
- `docs/design-system/README.md`（入口）
- `docs/design-system/tokens.md`（顏色 / spacing / typography 完整清單）
- `docs/design-system/components.md`（元件 + variants 速查）
- `docs/design-system/patterns.md`（10 個常用 UI 組合）
- `docs/design-system/migration.md`（84 hex → token 對照）

**新元件 variants：** Button 新增 `cta` / `cta-outline` / `outline-soft`；Badge 新增 `neutral` / `brand` / `success` / `warning` / `info`；Card 新增 `default` / `elevated` / `flat` / `interactive`。

**Lint 防漏：** `eslint.config.mjs` 加 `no-restricted-syntax` 規則，新增的 `bg-[#...]` `text-[#...]` `style={{ color: '#...' }}` 等硬碼 hex 會被擋下並指向 `tokens.md`。例外清單見該檔。

**主品牌色：** `#26C8C2`（teal）→ `--brand-500`。`--primary` 仍為黑，`--cta` 已換為 teal。Dark mode 暫不維護。
