# 登入 / 註冊流程說明

## 登入方式總覽

| 方式 | 頁面 | 流程 |
|------|------|------|
| Google OAuth | `/login` 或 `/register` | OAuth → `/callback` → onboarding 判斷 |
| Email Magic Link | `/register` | OTP email → `/callback` → onboarding 判斷 |
| Email / Password | `/login` | 直接 signInWithPassword → onboarding 判斷 |

---

## 流程一：Google OAuth / Email Magic Link

```
/register 或 /login
  │
  ├─ Google OAuth: supabase.auth.signInWithOAuth()
  └─ Email OTP:    supabase.auth.signInWithOtp()
       │
       │  redirectTo = /callback?next=...
       ▼
Google / Email 驗證
       │
       ▼
GET /callback?code=...&next=...
  1. exchangeCodeForSession(code)          ← 用 code 換 session
  2. profiles.insert(buildProfilePayload)   ← 嘗試建立 profile（已存在則 23505 忽略）
  3. SELECT profiles.username WHERE id=user.id
       │
       ├─ username 為空 → redirect /onboarding?next=...
       └─ username 有值 → redirect /next
```

---

## 流程二：Email / Password 登入

```
/login
  │
  supabase.auth.signInWithPassword()
  │
  ├─ 失敗 → 顯示錯誤訊息
  └─ 成功
       │
       supabase.auth.getUser()
       SELECT profiles.username WHERE id=user.id
       │
       ├─ username 為空 → router.push(/onboarding?next=...)
       └─ username 有值 → router.push(safeNext)
```

---

## Onboarding 流程

```
/onboarding
  │
  useEffect mount:
  ├─ 未登入 → router.replace('/login')
  ├─ 已有 username → router.replace('/')         ← 防止跳過 onboarding
  └─ 無 username → 顯示表單
       │
       使用者填寫 username / 顯示名稱 / 頭貼（選填）
       │
       handleSubmit:
       ├─ isEmailUser → supabase.auth.updateUser({ password })  ← 設定密碼
       ├─ 上傳頭貼（若有 pendingFile）
       └─ trpc.auth.completeOnboarding.mutate()
            │
            Server 端再次確認 username 是否已存在（防重複送出）
            │
            ├─ 成功 → router.push(safeNext)
            ├─ '已設定完成' → router.push(safeNext)
            └─ 其他錯誤 → toast.error
```

---

## Middleware 保護層（所有請求都會過）

**`middleware.ts` matcher**：除靜態資源外，所有 request 都會經過。

### 規則一：需要登入的路徑

若未登入且訪問以下路徑 → redirect `/login?next=pathname`

```
/favorites
/become-seller
/messages
/notifications
/dashboard
/admin
/onboarding
```

### 規則二：未完成 onboarding 的強制導向

若已登入但 `profiles.username` 為空，且不在以下 bypass 路徑 → redirect `/onboarding`

```
/onboarding         ← onboarding 本身
/login              ← 允許重新登入
/register           ← 允許註冊
/callback           ← OAuth / magic link 換 session
/forgot-password    ← 忘記密碼
/reset-password     ← 重設密碼
/api                ← API 路由
```

### 規則三：onboarding 狀態的 cookie 快取

為避免每個請求都查一次 `profiles.username`，完成 onboarding 後 middleware 會種一個
`onboarding_done=1` cookie（httpOnly、正式環境帶 `secure`、效期一年）。之後請求只要看到
這顆 cookie 就略過 DB 查詢。

**換帳號防護**：因為這顆 cookie 沒有綁定特定使用者，middleware 在偵測到「目前沒有登入者」
（登出後）時會主動刪除它，避免同一瀏覽器換另一個尚未完成 onboarding 的帳號時，沿用前一個人的
「已完成」狀態而跳過設定頁。

---

## Server 端防護（tRPC）

`auth.completeOnboarding`：
- 再次查詢 `profiles.username`，已有值 → throw `BAD_REQUEST '個人資料已設定完成'`
- username 衝突（DB unique 23505）→ throw `CONFLICT '此 username 已被使用'`

`auth.checkEmailRegistered`：
- 註冊頁送驗證信前呼叫，輸入 Email → 回傳 `{ registered }`
- 底層呼叫 DB 函式 `email_is_verified(p_email)`（SECURITY DEFINER，僅 service_role 可執行），
  查 `auth.users` 中 `email_confirmed_at` 不為空的帳號
- 只擋「已完成驗證」的帳號；還沒點驗證信的人允許重寄，不會被卡死

---

## 註冊重複防護

`/register` 的 Email 註冊在送出驗證信前，先呼叫 `auth.checkEmailRegistered`：

```
輸入 Email → checkEmailRegistered
  ├─ 已驗證帳號 → 顯示「此 Email 已註冊，請改用登入」，不寄信
  └─ 未驗證 / 全新 → 照舊 signInWithOtp 寄出驗證信
```

- 檢查服務異常時採「放行」：寄出的仍是一次性連結，對既有帳號只會變成登入連結，無重複建立風險。
- Google 註冊不受影響：同一 Email 走 Google 本來就是登入同一帳號，不算重複註冊。

---

## 防護層總結

| 層級 | 位置 | 防護內容 |
|------|------|----------|
| Server（最強） | `middleware.ts` | 已登入無 username → 強制 /onboarding；無登入者時清掉 onboarding cookie |
| Server | `callback/route.ts` | OAuth/OTP 後查 username 決定導向；建 profile 失敗導回 /login |
| Server | `tRPC completeOnboarding` | 防止重複完成 onboarding |
| Server | `tRPC checkEmailRegistered` | 註冊頁擋掉已驗證的 Email |
| Client | `login/page.tsx` | 密碼登入後查 username 決定導向 |
| Client | `register/page.tsx` | 送驗證信前先檢查 Email 是否已註冊 |
| Client | `onboarding/page.tsx` | 已有 username 者進入頁面直接導回首頁 |
