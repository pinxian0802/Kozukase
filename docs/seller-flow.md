# 賣家流程說明

## 頁面與路由總覽

| 路由 | 頁面 |
|---|---|
| `/settings` | 成為賣家（入口） |
| `/dashboard` | 儀表板首頁 |
| `/dashboard/listings` | 代購管理列表 |
| `/dashboard/listings/new` | 新增代購（3 步驟） |
| `/dashboard/listings/[id]/edit` | 編輯代購 |
| `/dashboard/connections` | 連線代購管理列表 |
| `/dashboard/connections/new` | 新增連線 |
| `/dashboard/connections/[id]/edit` | 編輯連線 |
| `/dashboard/profile` | 賣家設定（名稱、社群帳號） |

所有 `/dashboard/*` 路由均需：已登入 + `isSeller = true`（否則跳轉至 `/settings`）

---

## 一、成為賣家

路由：`/settings`

填寫以下資料後送出，系統建立 `sellers` 記錄並跳轉至 `/dashboard`：

| 欄位 | 必填 | 說明 |
|---|---|---|
| 賣家名稱 | 是 | 公開顯示的店名 |
| 電話號碼 | 是 | 不公開，僅供平台使用 |
| 服務地區 | 是 | 多選，代表賣家提供代購的國家 |

---

## 二、儀表板 `/dashboard`

顯示 4 個數字卡片（代購上限 25 筆）：

| 卡片 | 說明 |
|---|---|
| 全部代購 | 目前總筆數 / 25 |
| 上架中 | `status = active` 的數量 |
| 草稿 | `status = draft` 的數量 |
| 待審核 | `status = pending_approval` 的數量 |

快速入口：**新增代購** / **新增連線**
近期連線列表顯示於頁面下方。

---

## 三、新增代購 `/dashboard/listings/new`

### Step 1 — 搜尋或選擇商品

- 使用搜尋欄搜尋現有商品（`product.search`，最多 20 筆）
- 找到 → 點選後直接跳至 Step 3
- 找不到 → 點「新增商品」進入 Step 2

### Step 2 — 新增商品（僅在新建商品時）

| 欄位 | 必填 |
|---|---|
| 商品目錄圖片 | 是 |
| 商品名稱 | 是 |
| 品牌 | 否 |
| 型號 | 否 |
| 分類 | 否 |
| 商品國家 | 否 |

圖片上傳流程：
1. 取得 Cloudflare R2 presigned URL（`upload.getPresignedUrl`）
2. 客戶端直接上傳至 R2
3. 呼叫 `upload.confirmProductImage` 建立 DB 記錄並設為目錄封面

### Step 3 — 填寫上架資料

| 欄位 | 必填（發布） | 說明 |
|---|---|---|
| 上架圖片 | 否 | 最多 5 張 |
| 價格 | 是（除非勾「私訊報價」） | NT$ |
| 私訊報價 | — | 勾選後不需填價格 |
| 規格 | 否 | 可多項，每項有選項；可勾「都有」 |
| 備註 | 否 | 額外說明 |
| 貼文連結 | 是 | 社群貼文 URL（IG / Threads） |
| 出貨天數 | 是 | 最少 1 天 |
| 下架日期 | 否 | 選填到期時間 |

### 送出選項

| 動作 | 結果 |
|---|---|
| 存為草稿 | `status = draft`，可隨時編輯或發布 |
| 發布 | 驗證必填欄位 → 上傳圖片 → `status = pending_approval` → 等待管理員審核 |

**發布流程細節：**
1. 建立草稿（`listing.create`）
2. 上傳圖片至 R2（`upload.getPresignedUrl` × N）
3. 建立圖片記錄（`upload.confirmListingImages`）
4. 發布（`listing.publish`）→ 通知許願此商品 / 追蹤此賣家的使用者

**失敗補償：** 若圖片上傳後後續步驟失敗，自動刪除孤立的 R2 物件及草稿記錄。

---

## 四、代購管理 `/dashboard/listings`

Tab 篩選：全部 / 上架中 / 草稿 / 下架 / 待審核

| 狀態 | 可操作 |
|---|---|
| `draft` | 編輯、發布、刪除 |
| `pending_approval` | 編輯 |
| `active` | 編輯、下架 |
| `inactive`（自己下架） | 編輯、重新上架（→ `active`） |
| `inactive`（管理員移除） | 編輯、重新申請（→ `pending_approval`） |

---

## 五、代購狀態轉換

```
draft
 ├─[發布]──→ pending_approval ──[管理員通過]──→ active
 │                │                              │
 │          [管理員駁回]                      [下架]
 │                ↓                              ↓
 └─[刪除]    inactive ←──────────────────── inactive
             (admin)   [重新申請→pending]   (self)
                                             [重新上架→active]
```

---

## 六、連線代購管理 `/dashboard/connections`

連線代購讓買家看到賣家目前在哪個國家，可即時代購。上限 **5 筆**。

### 新增連線欄位

| 欄位 | 必填 |
|---|---|
| 連線國家 | 是 |
| 地區（城市） | 否 |
| 開始日期 | 是（最早今天） |
| 結束日期 | 是（至少開始日 +1 天） |
| 圖片 | 否 |
| 描述 | 否 |

### 連線狀態與操作

| 狀態 | 可操作 |
|---|---|
| `active` | 編輯、結束（→ `ended`，reason=`self`） |
| `pending_approval` | 編輯 |
| `ended`（自己結束） | 重新啟動（→ `active`） |
| `ended`（管理員移除） | 重新申請（→ `pending_approval`） |

### 連線狀態轉換

```
active ──[結束]──→ ended(self) ──[重新啟動]──→ active

pending_approval ──[管理員通過]──→ active
                 ──[管理員移除]──→ ended(admin) ──[重新申請]──→ pending_approval
```

---

## 七、賣家設定 `/dashboard/profile`

### 基本資料
- 修改賣家名稱（`seller.update`）

### 社群帳號連結（OAuth）

支援 Instagram 和 Threads。連結後：
- 自動抓取 handle（@帳號）與粉絲數
- `is_social_verified = true` → 賣家頁顯示認證徽章

| 操作 | 說明 |
|---|---|
| 連結 | 導向 OAuth 同意頁（`/api/auth/instagram/connect` 或 `/api/auth/threads/connect`） |
| 重新連結 | Token 過期時重新驗證 |
| 取消連結 | 刪除 `social_tokens` 記錄，清除相關欄位 |

---

## 八、管理員審核

賣家的**代購**在發布 / 重新申請後進入 `pending_approval`，需管理員在 `/admin/listings` 審核：

| 動作 | 結果 |
|---|---|
| 通過 | `status = active`，通知賣家 |
| 駁回 | `status = inactive`，附原因，通知賣家 |

**連線代購**在特定情況（被管理員移除後重申請）也需審核，流程相同（`/admin/connections`）。

---

## 九、完整旅程

```
註冊 / 登入 → 帳號設定（/onboarding）
  └→ 成為賣家（/settings）
       └→ 儀表板（/dashboard）
            ├→ 新增代購（3 步驟）
            │    └→ 草稿 / 待審核 → [管理員通過] → 上架中
            ├→ 管理代購（/dashboard/listings）
            │    └→ 編輯 / 下架 / 重新上架
            ├→ 新增連線（/dashboard/connections/new）
            │    └→ 進行中 / 待審核
            └→ 賣家設定（/dashboard/profile）
                 └→ 連結 IG / Threads → 取得認證徽章
```
