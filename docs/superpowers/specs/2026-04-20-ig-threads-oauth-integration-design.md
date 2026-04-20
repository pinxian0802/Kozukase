# IG / Threads OAuth 整合設計文件

**日期：** 2026-04-20  
**狀態：** 待實作  
**範圍：** 賣家社群帳號串接（Instagram + Threads），取代現有手動填寫流程

---

## 背景與目標

目前賣家可在後台手動填寫 IG / Threads 帳號名稱與粉絲數，無法驗證真實性。  
此次改為透過 Meta 官方 OAuth 流程串接，讓平台自動抓取帳號名稱與粉絲數，提升資料可信度與賣家認證的意義。

**成功標準：**
- 賣家可透過 OAuth 連結 Instagram 和/或 Threads
- 連結後自動顯示帳號名稱與粉絲數
- 進入後台時靜默刷新 token 與粉絲數
- Token 失效時自動清除並提示重新連結
- 前端完全無法存取 access token

---

## 資料庫

### 新增表：`social_tokens`

```sql
CREATE TABLE social_tokens (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id      uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  platform       text NOT NULL CHECK (platform IN ('instagram', 'threads')),
  access_token   text NOT NULL,  -- 以 pgcrypto 加密儲存
  expires_at     timestamptz NOT NULL,
  last_refreshed timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seller_id, platform)
);

-- RLS：僅 service_role 可存取，前端完全無法讀寫
ALTER TABLE social_tokens ENABLE ROW LEVEL SECURITY;
-- 不建立任何允許 anon / authenticated 的 policy
```

### `sellers` 表新增欄位

```sql
ALTER TABLE sellers
  ADD COLUMN ig_connected_at      timestamptz,
  ADD COLUMN threads_connected_at timestamptz;
```

現有欄位（`ig_handle`, `ig_follower_count`, `threads_handle`, `threads_follower_count`, `is_social_verified`）保留，改為由 API 寫入，不再接受前端直接傳值。

**需同步修改：** `lib/validators/seller.ts` 的 `updateSellerSchema` 移除 `ig_handle`、`ig_follower_count`、`threads_handle`、`threads_follower_count` 欄位，避免前端繞過 OAuth 直接寫入。

---

## OAuth 流程

IG 和 Threads 各自獨立，流程完全相同，僅 endpoint 路徑與 Meta App 設定不同。

### Step 1 — 發起授權

```
GET /api/auth/instagram/connect
GET /api/auth/threads/connect
```

- 產生隨機 `state`（16 bytes hex），寫入 httpOnly cookie（有效期 10 分鐘）
- Redirect 到 Meta 授權 URL，帶上 `client_id`、`redirect_uri`、`scope`、`state`

**所需 scope：**
- Instagram：`instagram_basic`（帳號資訊 + 粉絲數）
- Threads：`threads_basic`（帳號資訊 + 粉絲數）

### Step 2 — OAuth Callback

```
GET /api/auth/instagram/callback?code=xxx&state=xxx
GET /api/auth/threads/callback?code=xxx&state=xxx
```

1. 驗證 `state` 與 cookie 一致（防 CSRF）
2. 用 `code` 換取 short-lived token（POST 到 Meta token endpoint）
3. 用 short-lived token 換取 long-lived token（有效期 60 天）
4. 呼叫 Graph API 取得 `username` 與 `followers_count`
5. 以 pgcrypto 加密 token，寫入 `social_tokens`（upsert by seller_id + platform）
6. 更新 `sellers`：
   - `ig_handle` / `threads_handle` ← username
   - `ig_follower_count` / `threads_follower_count` ← followers_count
   - `ig_connected_at` / `threads_connected_at` ← now()
   - `is_social_verified` ← true
7. Redirect 回 `/dashboard/profile?connected=instagram`（或 threads）

---

## Token 自動刷新

**觸發時機：** 賣家進入後台時，在 `app/(seller)/dashboard/layout.tsx`（Server Component）執行，不阻塞頁面渲染（fire-and-forget）

**邏輯（`refreshSocialTokens(sellerId)`）：**

```
for each platform in ['instagram', 'threads']:
  token = 從 social_tokens 取得（by seller_id + platform）
  if not found: skip
  if expires_at - now() > 7 days: skip（不需刷新）
  
  呼叫 Meta token refresh endpoint
  成功:
    更新 social_tokens: access_token, expires_at, last_refreshed
    呼叫 Graph API 重新抓 followers_count
    更新 sellers: ig_follower_count / threads_follower_count
  失敗（token 已撤銷或無效）:
    刪除 social_tokens 該 row
    清空 sellers: ig_handle, ig_follower_count, ig_connected_at（或 threads 對應欄位）
    重算 is_social_verified（另一平台若仍連結則維持 true）
```

刷新過程為靜默背景操作，不阻塞頁面載入，失敗不拋錯給用戶（除非兩平台都失效）。

---

## 前端 UI（賣家後台 Profile 頁）

### 現有行為
- 手動 Input 填寫帳號名稱與粉絲數

### 改為

```
社群連結區塊
├── Instagram
│   ├── [未連結狀態]
│   │   └── 按鈕：「連結 Instagram」→ GET /api/auth/instagram/connect
│   └── [已連結狀態]
│       ├── 顯示：@帳號名稱、粉絲數、連結時間
│       ├── 按鈕：「重新連結」→ 重走 OAuth（更新 token 與粉絲數）
│       └── 按鈕：「取消連結」→ tRPC mutation 清除 token 與 sellers 欄位
└── Threads（同上）
```

- 移除手動輸入的 `ig_handle`、`ig_follower_count`、`threads_handle`、`threads_follower_count` input 欄位
- 連結成功後 URL 帶 `?connected=instagram` → 前端顯示 toast「Instagram 已成功連結」
- Token 失效（後台刷新清除後）→ 顯示 badge「需要重新連結」

---

## 取消連結

```
tRPC mutation: seller.disconnectSocial({ platform: 'instagram' | 'threads' })
```

- 刪除 `social_tokens` 對應 row
- 清空 `sellers` 對應欄位（handle, follower_count, connected_at）
- 重算 `is_social_verified`

---

## 錯誤處理

| 情境 | 處理方式 |
|------|---------|
| 用戶在 Meta 頁面取消授權 | callback 收到 `error=access_denied`，redirect 回 profile 頁加 `?error=cancelled`，前端 toast 提示「已取消連結」 |
| state 不符（CSRF 攻擊） | 回傳 400，redirect 回 profile 頁加 `?error=invalid_state`，前端 toast 提示「連結失敗，請重試」 |
| code 換 token 失敗 | 記 server error log，redirect 加 `?error=token_exchange`，前端 toast 提示「連結失敗，請重試」 |
| Graph API 呼叫失敗 | token 仍儲存，sellers 欄位不更新，redirect 加 `?error=fetch_failed`，前端提示「已連結，但無法取得帳號資料，請稍後重試」 |
| Token refresh 失敗 | 清除 token 與社群欄位，前端靜默顯示「需重新連結」badge，不 crash |
| Graph API rate limit | retry 1 次（exponential backoff），仍失敗則保留舊粉絲數，不更新 |
| 用戶未完成 Meta App 授權（scope 不足） | callback 收到 scope 錯誤，視為取消處理 |

---

## 環境變數（需新增）

```env
# Instagram
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=
INSTAGRAM_REDIRECT_URI=https://yourdomain.com/api/auth/instagram/callback

# Threads
THREADS_CLIENT_ID=
THREADS_CLIENT_SECRET=
THREADS_REDIRECT_URI=https://yourdomain.com/api/auth/threads/callback

# Token 加密金鑰（pgcrypto 用）
SOCIAL_TOKEN_ENCRYPTION_KEY=
```

---

## 不在此次範圍

- Meta App 申請與商業審核（需開發者自行操作）
- Threads 粉絲數若 API 未提供則顯示 `-`（Threads API 限制，非實作問題）
- 每個賣家僅支援連結一個 IG 帳號、一個 Threads 帳號
- 管理員後台不做社群資料管理
