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
/profile
/settings
/notifications
/dashboard
/admin
/onboarding
```

### 規則二：未完成 onboarding 的強制導向

若已登入但 `profiles.username` 為空，且不在以下 bypass 路徑 → redirect `/onboarding`

```
/onboarding   ← onboarding 本身
/login        ← 允許重新登入
/register     ← 允許註冊
/auth         ← ⚠️ 見問題說明
```

---

## Server 端防護（tRPC）

`auth.completeOnboarding`：
- 再次查詢 `profiles.username`，已有值 → throw `BAD_REQUEST '個人資料已設定完成'`
- username 衝突（DB unique 23505）→ throw `CONFLICT '此 username 已被使用'`

---

## 已知問題

### 問題一：`/callback` 未加入 bypass 清單（會造成斷流）

**影響場景**：已登入但尚未完成 onboarding 的用戶，點擊 email magic link 或重新 OAuth 時，
request 會先進 middleware → `user` 存在且無 username → redirect 到 `/onboarding`，
導致 `/callback` handler 根本不會執行，code 無法被換成 session。

**修法**：將 `/callback` 加入 `ONBOARDING_BYPASS_PREFIXES`。

---

### 問題二：`/auth` 是無效的 bypass 設定

`app/(auth)/callback/route.ts` 中的 `(auth)` 是 Next.js route group，**不影響 URL**，
實際路徑是 `/callback` 而非 `/auth/callback`。
目前 `/auth` bypass 項目沒有對應到任何真實路由，等同無用。

**修法**：移除 `/auth`，改為 `/callback`。

---

### 問題三：每次請求都查詢 DB（效能）

middleware 的 onboarding 檢查對每一個已登入的請求都執行一次 `profiles.username` 查詢。
用戶完成 onboarding 後，這個查詢在每次頁面請求都重複發生，屬於不必要的開銷。

**建議修法**：完成 onboarding 後在 cookie 寫入一個 `onboarding_done=1` 的 flag，
middleware 優先讀 cookie，只有 cookie 不存在時才查 DB，避免每次都打資料庫。

---

## 防護層總結

| 層級 | 位置 | 防護內容 |
|------|------|----------|
| Server（最強） | `middleware.ts` | 已登入無 username → 強制 /onboarding |
| Server | `callback/route.ts` | OAuth/OTP 後查 username 決定導向 |
| Server | `tRPC completeOnboarding` | 防止重複完成 onboarding |
| Client | `login/page.tsx` | 密碼登入後查 username 決定導向 |
| Client | `onboarding/page.tsx` | 已有 username 者進入頁面直接導回首頁 |
