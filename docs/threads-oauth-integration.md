# Threads OAuth 串接文件

## 概覽

本專案使用 Meta Threads API 讓賣家帳號連結自己的 Threads，取得帳號資訊與粉絲數，作為社群驗證依據。

---

## 環境變數

在 `.env.local` 設定以下變數：

| 變數名稱 | 說明 | 取得位置 |
|---|---|---|
| `THREADS_CLIENT_ID` | 應用程式編號 | FB Developers → 應用程式 → 設定 → 基本資料 |
| `THREADS_CLIENT_SECRET` | 應用程式密鑰 | 同上 |
| `THREADS_REDIRECT_URI` | OAuth callback URL | 自行設定（見下方說明） |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | 64 字元 hex，用於加密 DB 內的 token | `openssl rand -hex 32` 產生 |

### THREADS_REDIRECT_URI 設定規則

| 環境 | 值 |
|---|---|
| 本機開發（透過 ngrok） | `https://<ngrok-subdomain>.ngrok-free.dev/api/auth/threads/callback` |
| 正式環境 | `https://yourdomain.com/api/auth/threads/callback` |

> **重要**：本機開發時必須透過 ngrok 網址開啟網站，不能用 `localhost`。  
> 原因：OAuth callback 回來的網域必須與發起請求的網域相同，否則 CSRF state cookie 會讀不到。

---

## FB Developers 後台設定

### 應用程式需啟用的權限（Scopes）

| Scope | 用途 |
|---|---|
| `threads_basic` | 讀取帳號 id、username、大頭貼 |
| `threads_manage_insights` | 讀取粉絲數（`followers_count`） |

### 需要填寫的 Callback URL

在 **Threads → 設定 → 重新導向回呼網址** 填入：
```
https://<your-domain>/api/auth/threads/callback
```

### 測試帳號

應用程式在**開發模式**時，只有被加入為測試用戶的帳號才能授權。

路徑：**應用程式 → Roles → Test Users**

登入 FB Developers 的管理員帳號本身不需要加入，直接有權限。

---

## 程式碼架構

```
app/api/auth/threads/
├── connect/route.ts    # 發起 OAuth 授權
└── callback/route.ts   # 接收授權結果、換 token、存 DB
lib/utils/social-tokens.ts  # token 加解密、自動刷新
```

---

## OAuth 流程說明

### Step 1：發起授權（`/api/auth/threads/connect`）

1. 確認使用者已登入（Supabase session）
2. 產生隨機 16 bytes hex 作為 `state`，存入 httpOnly cookie（有效 10 分鐘）
3. 帶著以下參數重導向到 `https://www.threads.net/oauth/authorize`：
   - `client_id`
   - `redirect_uri`
   - `scope`: `threads_basic,threads_manage_insights`
   - `response_type`: `code`
   - `state`

### Step 2：接收 Callback（`/api/auth/threads/callback`）

Threads 授權完成後會帶著 `code` 和 `state` 回到此 endpoint。

**驗證流程：**
1. 若帶有 `error=access_denied`，代表用戶取消，導回 profile 頁
2. 比對 `state` 與 cookie 中的值，不符則拒絕（防 CSRF）
3. 確認 Supabase session 仍有效

**Token 交換：**

```
code（授權碼）
  ↓ POST https://graph.threads.net/oauth/access_token
short-lived access token（有效期短）
  ↓ GET https://graph.threads.net/access_token?grant_type=th_exchange_token
long-lived access token（有效期 60 天）
```

### Step 3：取得帳號資訊

```
GET https://graph.threads.net/me?fields=id,username,threads_profile_picture_url
```

### Step 4：取得粉絲數

```
GET https://graph.threads.net/me/threads_insights?metric=followers_count&period=lifetime
```

回傳格式：
```json
{
  "data": [{
    "name": "followers_count",
    "total_value": { "value": 107 }
  }]
}
```

取值路徑：`data[0].total_value.value`

> 粉絲數取得失敗不會中斷主流程，僅印 warning log。

### Step 5：加密儲存 Token

使用 **AES-256-GCM** 加密後存入 `social_tokens` 表：

```
格式：base64(iv):base64(authTag):base64(ciphertext)
```

### Step 6：更新 sellers 表

```sql
UPDATE sellers SET
  threads_connected_at = NOW(),
  threads_handle = '<username>',
  threads_follower_count = <count>,
  is_social_verified = true
WHERE id = '<user_id>'
```

---

## Token 自動刷新（`lib/utils/social-tokens.ts`）

`refreshSocialTokens(sellerId)` 會在賣家進入後台時 fire-and-forget 執行：

- 距離過期 **超過 7 天**：跳過
- 距離過期 **7 天以內**：呼叫 Threads refresh API

```
GET https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=<token>
```

刷新成功後更新 `social_tokens.access_token` 與 `expires_at`。

刷新失敗（token 無效或已撤銷）時：
1. 刪除 `social_tokens` 中的該筆資料
2. 清除 `sellers` 表中的 `threads_handle`、`threads_follower_count`、`threads_connected_at`
3. 重算 `is_social_verified`（看 Instagram 是否仍連結）

---

## 錯誤代碼

callback 失敗時會帶 `?error=<code>` 重導向回 `/dashboard/profile`：

| 錯誤代碼 | 原因 |
|---|---|
| `cancelled` | 用戶在 Meta 頁面點取消 |
| `invalid_state` | CSRF state 不符（常見於從 localhost 發起但 callback 回 ngrok） |
| `token_exchange` | short-lived 或 long-lived token 換取失敗 |
| `fetch_failed` | 基本 profile 資訊取得失敗 |

---

## 本機開發注意事項

1. 安裝並啟動 ngrok：`ngrok http 3000`
2. 將 ngrok URL 更新至 `.env.local` 的 `THREADS_REDIRECT_URI`
3. 將同一 URL 填入 FB Developers 的重新導向回呼網址
4. **必須從 ngrok 網址開啟網站**，不能用 `localhost:3000`
5. 每次重啟 ngrok，URL 會變動（免費方案），需同步更新上述兩處

---

## 資料庫欄位

### `social_tokens` 表

| 欄位 | 型別 | 說明 |
|---|---|---|
| `seller_id` | uuid | 對應 sellers.id |
| `platform` | text | `'threads'` |
| `access_token` | text | AES-256-GCM 加密後的 token |
| `expires_at` | timestamptz | token 到期時間（約 60 天） |
| `last_refreshed` | timestamptz | 最後刷新時間 |

### `sellers` 表（相關欄位）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `threads_handle` | text | Threads 帳號名稱 |
| `threads_follower_count` | int | 粉絲數 |
| `threads_connected_at` | timestamptz | 連結時間 |
| `is_social_verified` | boolean | 是否已連結任一社群帳號 |
