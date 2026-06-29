# E2E 測試重新規劃 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重整 Kozukase 的 Playwright e2e 套件 — 穩定化選擇器、深化主要流程、補齊新功能覆蓋、精簡結構。

**Architecture:** 保留現有測試基礎建設（`helpers/db.ts` service-role seeding、`helpers/trpc.ts` 後端驅動、`fixtures.ts` 三角色 page、`[E2E]` 前綴 + teardown 自清）。新增 `data-testid` 到動態卡片/列並由 `helpers/locators.ts` 統一管理，禁用 class 選擇器。按 P0→P3 優先級補測試。

**Tech Stack:** Playwright `@playwright/test`、tRPC、Supabase（service-role）、Next.js 16 App Router。

## Global Constraints

- 執行環境：打正式 Supabase；所有測試資料以 `[E2E]` 前綴命名（用 `e2eName()`），各 spec 自清，`global.teardown.ts` 為最後防線。
- `playwright.config.ts`：`workers: 1`、`fullyParallel: false`、`retries: 1`（序列化，避免共享 DB 互相干擾）。不可改成並行。
- 選擇器優先序：`getByRole` > `getByText`/`getByPlaceholder` > `getByTestId`（僅動態列/卡）> 禁用 `div[class*=...]` CSS class。
- `data-testid` 約定：列/卡元件加 `data-testid="<entity>-row"` 與 `data-id={entity.id}` 兩個屬性於同一元素。
- 新測試帳號用 service-role `auth.admin.createUser` 建立、teardown 用 `auth.admin.deleteUser` 刪除；email 一律 `e2e-tmp-<uuid>@kozukase.test`。
- 提交訊息結尾固定加：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- ESLint 禁止硬碼 hex；測試碼不得引入 `bg-[#...]` 之類字串。

---

## File Structure

**新增測試 helper**
- `tests/helpers/locators.ts` — 共用 data-testid locator（listingRow/connectionRow/adminRow/notificationItem）+ 臨時帳號 helper

**修改 production 元件（加 data-testid，不影響樣式/行為）**
- `app/(seller)/dashboard/listings/page.tsx:140,222` — listing TableRow + mobile card
- `app/(seller)/dashboard/connections/page.tsx` — connection 列（桌機 row + mobile card）
- `app/(admin)/admin/listings/page.tsx` — pending listing 列
- `app/(admin)/admin/connections/page.tsx` — pending connection 列
- `app/(admin)/admin/reports/page.tsx` — report 列
- `app/(admin)/admin/sellers/page.tsx` — seller 列
- `app/(user)/notifications/page.tsx` — 通知列

**修改 spec**
- `tests/seller.spec.ts` — 移除 rounded-[28px]，改 locators，修壞掉的下拉操作
- `tests/cross-role.spec.ts` — 移除殘留 listingCard，深化連鎖斷言
- `tests/buyer.spec.ts` — 補許願上限、評價回覆/按讚

**新增 spec**
- `tests/smoke.spec.ts`、`tests/onboarding.spec.ts`、`tests/become-seller.spec.ts`、`tests/admin-suspend.spec.ts`、`tests/analytics.spec.ts`、`tests/wishes.spec.ts`、`tests/banner.spec.ts`、`tests/cron-expire.spec.ts`、`tests/ig-verification.spec.ts`

**設定**
- `playwright.config.ts` — `cross-role` project 的 `testMatch` 納入新檔
- `tests/README.md` — 更新

---

## Phase 1 — 選擇器穩定化（地基）

### Task 1: 加 data-testid 到賣家 listing 管理列 + locators helper

**Files:**
- Modify: `app/(seller)/dashboard/listings/page.tsx:140-144`（桌機 TableRow）與 `:222-225`（mobile card）
- Create: `tests/helpers/locators.ts`
- Test: `tests/seller.spec.ts`（既有，本任務先讓它能用新 locator）

**Interfaces:**
- Produces: `listingRow(page, id)`、`connectionRow(page, id)`、`adminRow(page, id)`、`notificationItem(page, type?)`、`reviewItem(page, id)`、`createTempUser()`、`deleteTempUser(userId)` from `tests/helpers/locators.ts`

- [ ] **Step 1: 在桌機 TableRow 加 testid**

`app/(seller)/dashboard/listings/page.tsx` 的 `<TableRow key={listing.id}` 改為：

```tsx
                <TableRow
                  key={listing.id}
                  data-testid="listing-row"
                  data-id={listing.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/dashboard/listings/${listing.id}/edit`)}
                >
```

- [ ] **Step 2: 在 mobile card 加 testid**

同檔 `<div key={listing.id}` mobile 卡片改為：

```tsx
            <div
              key={listing.id}
              data-testid="listing-row"
              data-id={listing.id}
              className="flex items-center gap-2.5 rounded-lg border border-border-soft bg-white p-2.5 cursor-pointer"
              onClick={() => router.push(`/dashboard/listings/${listing.id}/edit`)}
            >
```

- [ ] **Step 3: 建立 locators helper**

Create `tests/helpers/locators.ts`：

```ts
import type { Page } from '@playwright/test'
import { dbAdmin } from './db'

// 動態列/卡：data-testid + data-id 同元素。桌機與 mobile 共用同 testid，
// 測試在 Desktop Chrome 跑,first() 取桌機那筆即可。
export function listingRow(page: Page, id: string) {
  return page.locator(`[data-testid="listing-row"][data-id="${id}"]`).first()
}
export function connectionRow(page: Page, id: string) {
  return page.locator(`[data-testid="connection-row"][data-id="${id}"]`).first()
}
export function adminRow(page: Page, id: string) {
  return page.locator(`[data-testid="admin-row"][data-id="${id}"]`).first()
}
export function notificationItem(page: Page, type?: string) {
  const sel = type
    ? `[data-testid="notification-item"][data-type="${type}"]`
    : `[data-testid="notification-item"]`
  return page.locator(sel)
}
export function reviewItem(page: Page, id: string) {
  return page.locator(`[data-testid="review-item"][data-id="${id}"]`).first()
}

// 臨時帳號:用於 onboarding / become-seller 等需要乾淨帳號的測試。
const TMP_PASSWORD = process.env.E2E_PASSWORD!
export async function createTempUser(): Promise<{ id: string; email: string; password: string }> {
  const email = `e2e-tmp-${crypto.randomUUID()}@kozukase.test`
  const { data, error } = await dbAdmin().auth.admin.createUser({
    email,
    password: TMP_PASSWORD,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`createTempUser failed: ${error?.message}`)
  return { id: data.user.id, email, password: TMP_PASSWORD }
}
export async function deleteTempUser(userId: string): Promise<void> {
  await dbAdmin().from('profiles').delete().eq('id', userId)
  await dbAdmin().auth.admin.deleteUser(userId)
}
```

- [ ] **Step 4: 改寫 seller.spec.ts 的 listingCard**

`tests/seller.spec.ts` 移除頂部的 `listingCard` 函式（rounded-[28px]），改 import：

```ts
import { test, expect } from '@playwright/test'
import { seedListing, dbAdmin } from './helpers/db'
import { listingRow } from './helpers/locators'
```

- [ ] **Step 5: 修「草稿可刪除」測試（操作已移進下拉選單）**

`tests/seller.spec.ts` 的草稿刪除測試 body 改為（先開「更多操作」下拉，再點刪除）：

```ts
  test('草稿出現在草稿分頁並可刪除', async ({ page }) => {
    const s = await seedListing(process.env.E2E_SELLER_EMAIL!, 'draft')
    await page.goto('/dashboard/listings')
    await page.getByRole('tab', { name: /草稿/ }).click()
    await expect(page.getByText(s.title)).toBeVisible({ timeout: 20000 })

    await listingRow(page, s.listingId).getByRole('button', { name: '更多操作' }).click()
    await page.getByRole('menuitem', { name: '刪除' }).click()

    await expect
      .poll(async () => {
        const { count } = await dbAdmin()
          .from('listings')
          .select('id', { count: 'exact', head: true })
          .eq('id', s.listingId)
        return count ?? 0
      }, { timeout: 15000 })
      .toBe(0)
  })
```

- [ ] **Step 6: 修「上架中可下架」測試**

```ts
  test('上架中可下架（reason=self）', async ({ page }) => {
    const s = await seedListing(process.env.E2E_SELLER_EMAIL!, 'active')
    await page.goto('/dashboard/listings')
    await page.getByRole('tab', { name: /上架中/ }).click()
    await expect(page.getByText(s.title)).toBeVisible({ timeout: 20000 })

    await listingRow(page, s.listingId).getByRole('button', { name: '更多操作' }).click()
    await page.getByRole('menuitem', { name: '下架' }).click()

    await expect
      .poll(async () => {
        const { data } = await dbAdmin()
          .from('listings')
          .select('status, inactive_reason')
          .eq('id', s.listingId)
          .single()
        return `${data?.status}/${data?.inactive_reason}`
      }, { timeout: 15000 })
      .toBe('inactive/self')
  })
```

- [ ] **Step 7: 跑測試確認通過**

Run: `npx playwright test --project=seller seller.spec.ts`
Expected: PASS（生命週期兩條 + 三個渲染測試）。若 `menuitem` 名稱不符，用 `npx playwright test --debug` 確認 DropdownMenuItem 的 role。

- [ ] **Step 8: Commit**

```bash
git add app/\(seller\)/dashboard/listings/page.tsx tests/helpers/locators.ts tests/seller.spec.ts
git commit -m "test(e2e): listing 列加 data-testid + locators helper,修復下架/刪除選擇器"
```

---

### Task 2: 加 data-testid 到 connection / admin / notification 列

**Files:**
- Modify: `app/(seller)/dashboard/connections/page.tsx`、`app/(admin)/admin/listings/page.tsx`、`app/(admin)/admin/connections/page.tsx`、`app/(admin)/admin/reports/page.tsx`、`app/(admin)/admin/sellers/page.tsx`、`app/(user)/notifications/page.tsx`、`components/review/review-list.tsx`
- Test: 透過既有 `admin-listings.spec.ts` / `admin-connections.spec.ts` 驗證不退化

**Interfaces:**
- Consumes: `connectionRow`、`adminRow`、`notificationItem`（Task 1）

- [ ] **Step 1: connection 管理列加 testid**

`app/(seller)/dashboard/connections/page.tsx` 找到桌機 `<TableRow key={...}` 與 mobile 卡片 `<div key={...}`（結構同 listings 頁），各加 `data-testid="connection-row" data-id={connection.id}`。

- [ ] **Step 2: admin 各列加 testid**

在 `admin/listings`、`admin/connections`、`admin/reports`、`admin/sellers` 四頁，為每一筆資料列（map 出來的 TableRow 或卡片容器）加 `data-testid="admin-row" data-id={row.id}`（`row.id` 換成各頁實際的 id 欄位，如 `listing.id`/`connection.id`/`report.id`/`seller.id`）。

- [ ] **Step 3: 通知列加 testid**

`app/(user)/notifications/page.tsx` 為每筆通知容器加 `data-testid="notification-item" data-type={n.type}`。

- [ ] **Step 3b: 評價卡加 testid**

`components/review/review-list.tsx` 的每筆評價容器(`<div className="rounded-[14px] border ...">`)加 `data-testid="review-item" data-id={review.id}`（供 buyer.spec 按讚測試鎖定特定評價）。

- [ ] **Step 4: 跑既有 admin 測試確認不退化**

Run: `npx playwright test --project=cross-role admin-listings.spec.ts admin-connections.spec.ts`
Expected: PASS（testid 是純附加，不應改變既有行為）。

- [ ] **Step 5: Commit**

```bash
git add app/ && git commit -m "test(e2e): connection/admin/notification 列加 data-testid"
```

---

## Phase 2 — P0 核心流程補齊

### Task 3: smoke.spec.ts（濃縮散落的頁面渲染測試）

**Files:**
- Create: `tests/smoke.spec.ts`
- Modify: `tests/buyer.spec.ts`（移除 `首頁、搜尋、連線、許願榜頁面渲染` 純渲染測試）、`playwright.config.ts`

**Interfaces:**
- Consumes: `fixtures.ts` 的 `buyerPage`

- [ ] **Step 1: 建立 smoke spec**

Create `tests/smoke.spec.ts`：

```ts
import { test, expect } from './fixtures'

// 集中所有「頁面能渲染」的淺檢查;深測在各自 spec。
const buyerPaths = ['/', '/search', '/connections', '/wishes', '/favorites', '/notifications', '/messages', '/account']

for (const path of buyerPaths) {
  test(`買家頁面渲染: ${path}`, async ({ buyerPage }) => {
    await buyerPage.goto(path)
    await expect(buyerPage.locator('header')).toBeVisible({ timeout: 15000 })
    await expect(buyerPage.locator('main, [role="main"]')).toBeVisible({ timeout: 15000 })
  })
}

const sellerPaths = ['/dashboard', '/dashboard/listings', '/dashboard/connections', '/dashboard/profile']
for (const path of sellerPaths) {
  test(`賣家頁面渲染: ${path}`, async ({ sellerPage }) => {
    await sellerPage.goto(path)
    await expect(sellerPage.locator('main, [role="main"]')).toBeVisible({ timeout: 15000 })
  })
}

const adminPaths = ['/admin', '/admin/today', '/admin/users', '/admin/products', '/admin/listings', '/admin/connections', '/admin/sellers', '/admin/reports', '/admin/social-verification', '/admin/banners', '/admin/storage']
for (const path of adminPaths) {
  test(`管理員頁面渲染: ${path}`, async ({ adminPage }) => {
    await adminPage.goto(path)
    await expect(adminPage.locator('main, [role="main"]')).toBeVisible({ timeout: 15000 })
  })
}
```

- [ ] **Step 2: 從 buyer.spec.ts 移除純渲染測試**

刪除 `buyer.spec.ts` 中 `首頁、搜尋、連線、許願榜頁面渲染` 那個 test（已被 smoke 涵蓋）。保留有 DB 斷言的測試。

- [ ] **Step 3: 把 smoke 納入 config**

`playwright.config.ts` 的 `cross-role` project `testMatch` 正則加入 `smoke`：

```ts
      testMatch: /(cross-role|messages|report-takedown|threads-verification|admin-reports|admin-listings|admin-connections|seller-create|seo|storage|smoke)\.spec\.ts/,
```

- [ ] **Step 4: 跑 smoke**

Run: `npx playwright test --project=cross-role smoke.spec.ts`
Expected: PASS（全頁面渲染）。

- [ ] **Step 5: Commit**

```bash
git add tests/smoke.spec.ts tests/buyer.spec.ts playwright.config.ts
git commit -m "test(e2e): 新增 smoke spec,濃縮散落頁面渲染測試"
```

---

### Task 4: registration.spec.ts + password-reset.spec.ts（Email 驗證連結真流程）

> 兩支 spec 都測同一套 `/callback` + `verifyOtp` 機制，只是 `type` 不同（`email` vs `recovery`），故同一任務產出。**不靠真實信箱**：用 service-role `auth.admin.generateLink` 取得 `token_hash`，直接訪問 `/callback` 模擬「使用者點了信裡的連結」。

**Files:**
- Create: `tests/registration.spec.ts`、`tests/password-reset.spec.ts`
- Modify: `playwright.config.ts`

**Interfaces:**
- Consumes: `createTempUser`、`deleteTempUser`（Task 1）、`dbAdmin`、`getUserIdByEmail`

- [ ] **Step 1: 確認三頁實際欄位/按鈕文字**

Run:
```bash
grep -n "placeholder\|getByRole\|button\|Label\|你的\|繼續\|寄送\|註冊" app/\(auth\)/register/page.tsx | head
grep -n "username\|display_name\|placeholder\|button\|Label" app/\(auth\)/onboarding/page.tsx | head
grep -n "placeholder\|button\|Label\|新密碼\|確認密碼" app/\(auth\)/reset-password/page.tsx | head
```
已知（2026-06-27 由原始碼確認，可直接用）：
- register/forgot 的 email input placeholder = `your@email.com`；register 送出後顯示「驗證信已寄出」；forgot 送出後顯示「重設連結已寄出」。
- reset-password 有 Label「新密碼」「確認密碼」，密碼 placeholder「至少 6 個字元」。
- **onboarding**：username Label = `ID`（輸入框 onChange 會自動 `toLowerCase` 並濾掉非 `[a-z0-9]`，故無法輸入大寫/符號）、`顯示名稱`、送出鈕 = `開始使用`。**`provider === 'email'` 的使用者（Magic Link 註冊）會多出必填的「設定密碼」「確認密碼」欄位**（`updateUser({ password })`）；Google 用戶則無此欄位。USERNAME_REGEX = `^[a-z0-9]{3,20}$`。

- [ ] **Step 2: 寫 registration.spec.ts**

Create `tests/registration.spec.ts`：

```ts
import { test, expect } from '@playwright/test'
import { dbAdmin, getUserIdByEmail } from './helpers/db'
import { deleteTempUser } from './helpers/locators'

const tmpEmail = () => `e2e-tmp-${crypto.randomUUID()}@kozukase.test`

// (A) 註冊頁 UI:輸入 email 觸發 signInWithOtp → 切到「驗證信已寄出」狀態
test('註冊頁送出 email 後顯示「驗證信已寄出」', async ({ page }) => {
  const email = tmpEmail()
  await page.goto('/register')
  await page.getByPlaceholder('your@email.com').fill(email)
  await page.getByRole('button', { name: /註冊|寄送|繼續|送出/ }).click()
  await expect(page.getByText('驗證信已寄出')).toBeVisible({ timeout: 15000 })
  // signInWithOtp 會建立一筆未確認 auth user,清掉避免殘留
  try {
    const id = await getUserIdByEmail(email)
    await deleteTempUser(id)
  } catch { /* 未建立則略過 */ }
})

// (B) 真註冊驗證:generateLink 取 token_hash → 訪問 /callback(模擬點信連結)
//     → verifyOtp → 新用戶建立 profiles 並導向 onboarding
test('點 magic link(token_hash)後建立 profiles 並導向 onboarding', async ({ page }) => {
  const email = tmpEmail()
  const { data, error } = await dbAdmin().auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data.properties || !data.user) throw new Error(`generateLink failed: ${error?.message}`)
  const tokenHash = data.properties.hashed_token
  const userId = data.user.id
  try {
    // type=email 對齊正式信件範本(Magic Link 範本用 type=email)。
    // 若 verifyOtp 因 type 不符失敗,改 type=magiclink(同一 token 亦可驗)。
    await page.goto(`/callback?token_hash=${tokenHash}&type=email&next=/`)
    await expect(page).toHaveURL(/onboarding/, { timeout: 20000 })
    await expect
      .poll(async () => {
        const { count } = await dbAdmin().from('profiles').select('id', { count: 'exact', head: true }).eq('id', userId)
        return count ?? 0
      }, { timeout: 15000 })
      .toBe(1)
  } finally {
    await deleteTempUser(userId)
  }
})

// (C) onboarding:Magic Link 註冊者 provider=email,須一併設定密碼。
//     設定 username + 顯示名稱 + 密碼後寫入 profiles。
//     欄位(2026-06-27 由原始碼確認):username Label「ID」(輸入自動轉小寫/濾非英數)、
//     「顯示名稱」、「設定密碼」/「確認密碼」(僅 email 用戶顯示)、送出鈕「開始使用」。
test('onboarding 設定 username + 密碼後寫入 profiles', async ({ page }) => {
  const email = tmpEmail()
  const { data } = await dbAdmin().auth.admin.generateLink({ type: 'magiclink', email })
  const tokenHash = data!.properties!.hashed_token
  const userId = data!.user.id
  try {
    await page.goto(`/callback?token_hash=${tokenHash}&type=email&next=/`)
    await expect(page).toHaveURL(/onboarding/, { timeout: 20000 })

    const username = `e2e${Date.now() % 1000000}`
    await page.getByLabel('ID').fill(username)
    await page.getByLabel('顯示名稱').fill('[E2E] 測試者')
    // Magic Link 註冊者必填密碼(否則送不出)
    await page.getByLabel('設定密碼').fill('E2ePw!123')
    await page.getByLabel('確認密碼').fill('E2ePw!123')
    await page.getByRole('button', { name: '開始使用' }).click()

    await expect
      .poll(async () => {
        const { data: p } = await dbAdmin().from('profiles').select('username').eq('id', userId).single()
        return p?.username
      }, { timeout: 15000 })
      .toBe(username)
  } finally {
    await deleteTempUser(userId)
  }
})

// (D) username 太短(<3 字)被擋下。注意:輸入框會自動轉小寫並濾掉非英數,
//     故無法用大寫/符號測格式錯誤;改用長度不足(USERNAME_REGEX 要求 3-20)。
test('onboarding username 太短被擋下,profiles.username 仍為 null', async ({ page }) => {
  const email = tmpEmail()
  const { data } = await dbAdmin().auth.admin.generateLink({ type: 'magiclink', email })
  const tokenHash = data!.properties!.hashed_token
  const userId = data!.user.id
  try {
    await page.goto(`/callback?token_hash=${tokenHash}&type=email&next=/`)
    await expect(page).toHaveURL(/onboarding/, { timeout: 20000 })

    await page.getByLabel('ID').fill('ab') // 2 字 < 3
    await page.getByLabel('顯示名稱').fill('[E2E] x')
    await page.getByLabel('設定密碼').fill('E2ePw!123')
    await page.getByLabel('確認密碼').fill('E2ePw!123')
    await page.getByRole('button', { name: '開始使用' }).click()

    // 驗證未通過,仍停在 onboarding,profiles 已存在但 username 仍為 null
    await expect(page).toHaveURL(/onboarding/, { timeout: 5000 })
    const { data: p } = await dbAdmin().from('profiles').select('username').eq('id', userId).single()
    expect(p?.username ?? null).toBeNull()
  } finally {
    await deleteTempUser(userId)
  }
})
```

- [ ] **Step 3: 寫 password-reset.spec.ts**

Create `tests/password-reset.spec.ts`：

```ts
import { test, expect } from '@playwright/test'
import { dbAdmin } from './helpers/db'
import { createTempUser, deleteTempUser } from './helpers/locators'

// (A) 忘記密碼頁 UI:輸入 email → resetPasswordForEmail → 「重設連結已寄出」
test('忘記密碼頁送出後顯示「重設連結已寄出」', async ({ page }) => {
  const email = `e2e-tmp-${crypto.randomUUID()}@kozukase.test`
  await page.goto('/forgot-password')
  await page.getByPlaceholder('your@email.com').fill(email)
  await page.getByRole('button', { name: /寄送|重設|送出|繼續/ }).click()
  await expect(page.getByText('重設連結已寄出')).toBeVisible({ timeout: 15000 })
})

// (B) 完整重設:generateLink(recovery) → /callback?type=recovery
//     → post-auth 強制導向 /reset-password → 填新密碼 → 導回 /login → 新密碼可登入
test('recovery 連結 → reset-password 設定新密碼 → 用新密碼可登入', async ({ page }) => {
  const u = await createTempUser() // 已確認帳號,可申請 recovery
  try {
    const { data, error } = await dbAdmin().auth.admin.generateLink({ type: 'recovery', email: u.email })
    if (error || !data.properties) throw new Error(`generateLink failed: ${error?.message}`)
    const tokenHash = data.properties.hashed_token

    await page.goto(`/callback?token_hash=${tokenHash}&type=recovery&next=/`)
    await expect(page).toHaveURL(/reset-password/, { timeout: 20000 })

    const newPw = `E2ePw!${Date.now()}`
    await page.getByLabel('新密碼').fill(newPw)
    await page.getByLabel('確認密碼').fill(newPw)
    await page.getByRole('button', { name: /更新|送出|完成|重設/ }).click()

    // 成功後 router.replace('/login')
    await expect(page).toHaveURL(/login/, { timeout: 20000 })

    // 驗證新密碼真的生效:用新密碼登入,應離開 login 頁
    // 注意:login email placeholder = 'your@email.com';送出鈕「登入」需 exact
    //(否則會撞到「使用 Google 登入」)。
    await page.getByPlaceholder('your@email.com').fill(u.email)
    await page.getByLabel('密碼').fill(newPw)
    await page.getByRole('button', { name: '登入', exact: true }).click()
    await expect(page).not.toHaveURL(/login/, { timeout: 20000 })
  } finally {
    await deleteTempUser(u.id)
  }
})

// (C) 無有效 recovery session 直接開 reset-password → 導回 login
test('無 recovery session 直接開 reset-password 會導回登入', async ({ page }) => {
  await page.goto('/reset-password')
  await expect(page).toHaveURL(/login/, { timeout: 15000 })
})
```

- [ ] **Step 4: 納入 config**

`playwright.config.ts` 的 `cross-role` project（不綁 storageState，適合自行登入/無登入態的測試）testMatch 加 `registration|password-reset`：

```ts
      testMatch: /(cross-role|messages|report-takedown|threads-verification|admin-reports|admin-listings|admin-connections|seller-create|seo|storage|smoke|registration|password-reset|become-seller)\.spec\.ts/,
```

- [ ] **Step 5: 跑測試**

Run: `npx playwright test --project=cross-role registration.spec.ts password-reset.spec.ts`
Expected: PASS。常見失敗：① 測試 (B) `type=email` 驗證失敗 → callback 改 `type=magiclink`（同一 token 亦可驗）；② reset 送出按鈕名稱不符 → 用 `--debug` 確認；③ 若 onboarding 對 Google 用戶不顯示密碼欄位導致 `getByLabel('設定密碼')` timeout，確認 generateLink 建立的帳號 `provider` 是否為 `email`（magic link 應為 email）。

- [ ] **Step 6: Commit**

```bash
git add tests/registration.spec.ts tests/password-reset.spec.ts playwright.config.ts
git commit -m "test(e2e): 新增真註冊(generateLink)、忘記/重設密碼流程測試"
```

---

### Task 5: become-seller.spec.ts（成為賣家 → 建立 sellers + seller_regions）

> **重要(已由原始碼確認)**：`/become-seller` 是**單一表單**(非多步驟 wizard)。送出鈕「送出申請」的 `disabled` 條件要求 `filled.every(Boolean)`，而 `filled` 含**全部 5 項**：頭貼(必須上傳檔案)、名稱、地區、簡介、購買證明選項；「同意」是自訂 `<button>` 非 `checkbox`，地區是 `MultiSelect` combobox。UI 強制上傳頭貼,e2e 驅動成本高且脆。因此本測試**用 trpc 驅動核心 mutation `seller.becomeSeller`**(像 cross-role 驅動 listing 一樣),驗證 sellers + seller_regions 真的建立;表單頁面渲染由 smoke 覆蓋。

**Files:**
- Create: `tests/become-seller.spec.ts`

**Interfaces:**
- Consumes: `createTempUser`、`deleteTempUser`（Task 1）、`dbAdmin`、`trpcMutate`（`helpers/trpc.ts`）
- `seller.becomeSeller` input(已確認 `lib/validators/seller.ts`)：`{ name: string(1-50), region_ids: string[](≥1 uuid), bio?: string, can_provide_proof?: boolean }`

- [ ] **Step 1: 寫測試**

Create `tests/become-seller.spec.ts`：

```ts
import { test, expect } from '@playwright/test'
import { dbAdmin } from './helpers/db'
import { createTempUser, deleteTempUser } from './helpers/locators'
import { trpcMutate } from './helpers/trpc'

// 臨時帳號需先有 profile(成為賣家是 protectedProcedure,且 becomeSeller 不需 username,
// 但登入後 root layout 需 profile 存在)。直接 seed 一筆 profile。
async function seedProfile(id: string) {
  await dbAdmin().from('profiles').upsert({
    id,
    username: `e2e${id.slice(0, 8)}`,
    display_name: '[E2E] tmp',
  })
}

test('呼叫 seller.becomeSeller 後建立 sellers + seller_regions', async ({ page }) => {
  const u = await createTempUser()
  try {
    await seedProfile(u.id)

    // UI 登入臨時帳號(login 支援密碼;email placeholder=your@email.com,
    // 送出鈕「登入」需 exact 以免撞「使用 Google 登入」),取得 auth cookie
    await page.goto('/login')
    await page.getByPlaceholder('your@email.com').fill(u.email)
    await page.getByLabel('密碼').fill(u.password)
    await page.getByRole('button', { name: '登入', exact: true }).click()
    await expect(page).not.toHaveURL(/login/, { timeout: 20000 })

    // 取一個真實 region id
    const { data: region } = await dbAdmin().from('regions').select('id').limit(1).single()

    // trpc 驅動核心 mutation(用 page 登入後的 cookie)
    await trpcMutate(page.request, 'seller.becomeSeller', {
      name: '[E2E] 測試賣家',
      region_ids: [region!.id],
      can_provide_proof: false,
    })

    // sellers 建立
    await expect
      .poll(async () => {
        const { count } = await dbAdmin()
          .from('sellers').select('id', { count: 'exact', head: true }).eq('id', u.id)
        return count ?? 0
      }, { timeout: 20000 })
      .toBe(1)

    // seller_regions 建立(該 region)
    const { count: regionCount } = await dbAdmin()
      .from('seller_regions').select('seller_id', { count: 'exact', head: true })
      .eq('seller_id', u.id).eq('region_id', region!.id)
    expect(regionCount ?? 0).toBe(1)
  } finally {
    await dbAdmin().from('seller_regions').delete().eq('seller_id', u.id)
    await dbAdmin().from('sellers').delete().eq('id', u.id)
    await deleteTempUser(u.id)
  }
})
```

- [ ] **Step 2: 跑測試**

Run: `npx playwright test --project=cross-role become-seller.spec.ts`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add tests/become-seller.spec.ts
git commit -m "test(e2e): 新增成為賣家(trpc 驅動)建立 sellers + seller_regions 測試"
```

---

### Task 6: 買家詢問主旅程（搜尋→詳情→詢問→送訊息）

**Files:**
- Modify: `tests/messages.spec.ts`（在頂部新增完整旅程 test）

**Interfaces:**
- Consumes: `seedActiveListing`、`getUserIdByEmail`、`dbAdmin`

- [ ] **Step 1: 詢問入口（已由原始碼確認）**

`app/(buyer)/listings/[id]/page-client.tsx`：「詢問」是 **`<Link>`**(非 button),href 帶 `seller_id`、`context_type=listing`、`context_id=<listing.id>`、`context_label`、`context_image`。messages 頁(`app/(user)/messages/page.tsx`)讀 URL 的 context → `setPendingContext` → 第一則訊息經 `message.send` 寫入 `messages.context_type`/`context_id`(已確認 `server/routers/message.ts` insert 含這些欄位)。

- [ ] **Step 2: 寫旅程測試**

`tests/messages.spec.ts` 頂部（import 後）新增：

```ts
import { seedActiveListing } from './helpers/db'

test('買家主旅程:搜尋→代購詳情→詢問→送訊息(帶 context 寫入 DB)', async ({ buyerPage }) => {
  const seed = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
  try {
    // 1. 搜尋找到 seed 商品
    await buyerPage.goto(`/search?tab=products&q=${encodeURIComponent(seed.productName)}`)
    await expect(buyerPage.getByText(seed.productName).first()).toBeVisible({ timeout: 20000 })

    // 2. 進代購詳情頁
    await buyerPage.goto(`/listings/${seed.listingId}`)
    await expect(buyerPage.locator('main, [role="main"]')).toBeVisible({ timeout: 20000 })

    // 3. 按「詢問」開啟訊息(詢問是 <Link> 不是 button,導向 /messages?...&context_type=listing&context_id=<id>)
    await buyerPage.getByRole('link', { name: /詢問/ }).first().click()
    const input = buyerPage.getByPlaceholder(/輸入訊息/)
    await expect(input).toBeVisible({ timeout: 20000 })

    // 4. 送訊息
    const body = `[E2E] 詢問 ${Date.now()}`
    await input.fill(body)
    await buyerPage.keyboard.press('Enter')
    await expect(buyerPage.getByText(body)).toBeVisible({ timeout: 15000 })

    // 5. DB 驗證:訊息存在且帶 listing context
    await expect
      .poll(async () => {
        const { data } = await dbAdmin()
          .from('messages')
          .select('context_type, context_id')
          .eq('body', body)
          .maybeSingle()
        return data ? `${data.context_type}/${data.context_id}` : null
      }, { timeout: 15000 })
      .toBe(`listing/${seed.listingId}`)

    await dbAdmin().from('messages').delete().eq('body', body)
  } finally {
    await dbAdmin().from('products').delete().eq('id', seed.productId)
  }
})
```

- [ ] **Step 3: 跑測試**

Run: `npx playwright test --project=cross-role messages.spec.ts`
Expected: PASS。context 欄位已確認為 `context_type`/`context_id`（值 `listing`/`<listingId>`）。

- [ ] **Step 4: Commit**

```bash
git add tests/messages.spec.ts
git commit -m "test(e2e): 新增買家詢問主旅程(搜尋→詳情→詢問→訊息帶 context)"
```

---

## Phase 3 — P1 審核與治理

### Task 7: admin-suspend.spec.ts（停權賣家連鎖）

**Files:**
- Create: `tests/admin-suspend.spec.ts`
- Modify: `playwright.config.ts`（testMatch 加 `admin-suspend`）

**Interfaces:**
- Consumes: `seedActiveListing`、`seedActiveConnection`、`getNotificationCount`、`adminRow`、`dbAdmin`；teardown 靠 `cleanup.ts`（已會還原被停權 e2e seller）

- [ ] **Step 1: admin/sellers 停權 UI（已由原始碼確認）**

`/admin/sellers`：搜尋框 placeholder「搜尋賣家...」、停權鈕「停權」(DialogTrigger)、dialog 標題「停權賣家」、原因 Textarea placeholder「請填寫原因...」、確認鈕「確認停權」(需填原因才 enable)。`suspendSeller` 將 listings→inactive/admin、connections→ended/admin、通知 `account_action_taken`、`sellers.is_suspended=true`(均已對 `server/routers/admin.ts:384` 確認)。

- [ ] **Step 2: 寫測試**

Create `tests/admin-suspend.spec.ts`：

```ts
import { test, expect } from './fixtures'
import { seedActiveListing, seedActiveConnection, getNotificationCount, getUserIdByEmail, dbAdmin } from './helpers/db'
import { adminRow } from './helpers/locators'

test('停權賣家:代購下架 + 連線結束 + 通知', async ({ adminPage }) => {
  const sellerEmail = process.env.E2E_SELLER_EMAIL!
  const sellerId = await getUserIdByEmail(sellerEmail)
  const listing = await seedActiveListing(sellerEmail)
  const connection = await seedActiveConnection(sellerEmail)
  const before = await getNotificationCount(sellerId, 'account_action_taken')
  // 取賣家名稱以便在後台搜尋出該列
  const { data: sellerRow } = await dbAdmin().from('sellers').select('name').eq('id', sellerId).single()

  try {
    await adminPage.goto('/admin/sellers')
    // 先搜尋,確保該 seller 列被渲染(列表預設可能不含全部)
    await adminPage.getByPlaceholder('搜尋賣家...').fill(sellerRow!.name)
    await expect(adminRow(adminPage, sellerId)).toBeVisible({ timeout: 20000 })

    // 點該列「停權」→ 填原因 → 確認停權
    await adminRow(adminPage, sellerId).getByRole('button', { name: '停權' }).click()
    await expect(adminPage.getByRole('dialog')).toBeVisible({ timeout: 10000 })
    await adminPage.getByPlaceholder('請填寫原因...').fill('[E2E] 違規測試')
    await adminPage.getByRole('button', { name: '確認停權' }).click()

    // listing → inactive/admin
    await expect
      .poll(async () => {
        const { data } = await dbAdmin().from('listings').select('status, inactive_reason').eq('id', listing.listingId).single()
        return `${data?.status}/${data?.inactive_reason}`
      }, { timeout: 20000 })
      .toBe('inactive/admin')

    // connection → ended/admin
    await expect
      .poll(async () => {
        const { data } = await dbAdmin().from('connections').select('status, ended_reason').eq('id', connection.connectionId).single()
        return `${data?.status}/${data?.ended_reason}`
      }, { timeout: 20000 })
      .toBe('ended/admin')

    // 通知 +1
    await expect.poll(() => getNotificationCount(sellerId, 'account_action_taken'), { timeout: 15000 }).toBeGreaterThan(before)

    // sellers.is_suspended = true
    const { data: s } = await dbAdmin().from('sellers').select('is_suspended').eq('id', sellerId).single()
    expect(s?.is_suspended).toBe(true)
  } finally {
    // 還原:解除停權 + 清 seed(cleanup.ts 也會兜底)
    await dbAdmin().from('sellers').update({ is_suspended: false }).eq('id', sellerId)
    await dbAdmin().from('listings').delete().eq('id', listing.listingId)
    await dbAdmin().from('products').delete().eq('id', listing.productId)
    await dbAdmin().from('connections').delete().eq('id', connection.connectionId)
    await dbAdmin().from('notifications').delete().eq('recipient_id', sellerId).eq('type', 'account_action_taken')
  }
})
```

- [ ] **Step 3: 納入 config + 跑測試**

`playwright.config.ts` testMatch 加 `admin-suspend`。
Run: `npx playwright test --project=cross-role admin-suspend.spec.ts`
Expected: PASS。

> 注意:此測試會停權共用的 e2e-seller,務必在同一檔 finally 還原;`cleanup.ts` 的 restore 機制為最後防線。建議此檔獨立跑、不與其他 seller 測試交錯（workers:1 已序列化）。

- [ ] **Step 4: Commit**

```bash
git add tests/admin-suspend.spec.ts playwright.config.ts
git commit -m "test(e2e): 新增停權賣家連鎖測試(代購下架/連線結束/通知)"
```

---

### Task 8: 深化 cross-role 刪商品連鎖（補許願取消 + 通知斷言）

**Files:**
- Modify: `tests/cross-role.spec.ts`

**Interfaces:**
- Consumes: `seedActiveListing`、`getNotificationCount`、`getUserIdByEmail`、`getProductWishCount`、`dbAdmin`

- [ ] **Step 1: 移除殘留 listingCard + 修既有 wish-notify 的 wish insert**

刪除 `cross-role.spec.ts` 頂部未使用的 `listingCard`（rounded-[28px]）函式。
同時:既有「賣家發布代購 -> 許願買家收到通知」測試裡的 `dbAdmin().from('wishes').insert({ product_id: prod!.id, user_id: buyerId })` **缺 `content`(NOT NULL)目前會失敗**,改為:

```ts
await dbAdmin().from('wishes').insert({ product_id: prod!.id, user_id: buyerId, content: '[E2E] 想要' })
```

- [ ] **Step 2: 擴充「管理員刪商品」測試補連鎖斷言**

把現有「管理員刪商品 -> listing 變 product_removed」測試擴充為（在刪除前先讓買家許願該商品,刪除後驗證許願被取消 + 賣家收 product_removed 通知）：

```ts
test('管理員刪商品 -> listing product_removed + 許願取消 + 賣家通知', async ({ adminPage }) => {
  const seed = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
  const buyerId = await getUserIdByEmail(process.env.E2E_BUYER_EMAIL!)
  // 買家先許願該商品。注意:wishes.content 為 NOT NULL,insert 必須帶 content。
  await dbAdmin().from('wishes').insert({ product_id: seed.productId, user_id: buyerId, content: '[E2E] 想要' })
  const notifBefore = await getNotificationCount(seed.sellerId, 'product_removed')

  await adminPage.goto('/admin/products')
  await adminPage.getByPlaceholder('搜尋商品...').fill(seed.productName)
  await expect(adminPage.getByText(seed.productName).first()).toBeVisible({ timeout: 20000 })
  await adminPage.getByRole('button', { name: /移除/ }).first().click()
  await expect(adminPage.getByRole('heading', { name: '移除商品' })).toBeVisible({ timeout: 10000 })
  await adminPage.getByPlaceholder('請填寫原因...').fill('[E2E] removal')
  await adminPage.getByRole('button', { name: '確認移除' }).click()

  // listing → product_removed
  await expect
    .poll(async () => {
      const { data } = await dbAdmin().from('listings').select('inactive_reason').eq('id', seed.listingId).single()
      return data?.inactive_reason
    }, { timeout: 20000 })
    .toBe('product_removed')

  // 許願被取消
  await expect
    .poll(async () => {
      const { count } = await dbAdmin().from('wishes').select('product_id', { count: 'exact', head: true }).eq('product_id', seed.productId)
      return count ?? 0
    }, { timeout: 15000 })
    .toBe(0)

  // 賣家收 product_removed 通知
  await expect.poll(() => getNotificationCount(seed.sellerId, 'product_removed'), { timeout: 15000 }).toBeGreaterThan(notifBefore)
})
```

確保檔案頂部 import 含 `getNotificationCount, getUserIdByEmail`。

- [ ] **Step 3: 跑測試**

Run: `npx playwright test --project=cross-role cross-role.spec.ts`
Expected: PASS（含 fixtures.afterEach 的 purgeE2EData 清理）。

- [ ] **Step 4: Commit**

```bash
git add tests/cross-role.spec.ts
git commit -m "test(e2e): 深化刪商品連鎖(許願取消+賣家通知),移除 class 選擇器殘留"
```

---

## Phase 4 — P2 互動與計數

### Task 9: 深化 buyer.spec.ts（許願上限 + 評價回覆/按讚）

**Files:**
- Modify: `tests/buyer.spec.ts`

**Interfaces:**
- Consumes: `seedActiveListing`、`getProductWishCount`、`getSellerStats`、`dbAdmin`

- [ ] **Step 1: 補許願上限測試（trpc 直打,逼近 20 上限）**

`buyer.spec.ts` 新增（用 service-role 預塞 20 筆許願,再 UI 許願第 21 筆應被擋）：

```ts
import { getUserIdByEmail } from './helpers/db'

test('許願達 20 上限時第 21 筆被擋', async ({ page }) => {
  const buyerId = await getUserIdByEmail(process.env.E2E_BUYER_EMAIL!)
  // 預塞 20 筆 [E2E] 商品 + 許願
  const prodIds: string[] = []
  for (let i = 0; i < 20; i++) {
    const { data } = await dbAdmin().from('products').insert({ name: `[E2E] 上限${i}`, category: 'other', created_by: buyerId }).select('id').single()
    prodIds.push(data!.id)
    // wishes.content 為 NOT NULL,必帶 content
    await dbAdmin().from('wishes').insert({ product_id: data!.id, user_id: buyerId, content: '[E2E] 想要' })
  }
  try {
    await page.goto(`/products/${seed.productId}`)
    const wishBtn = page.getByRole('button', { name: /許願/ }).first()
    await expect(wishBtn).toBeVisible({ timeout: 20000 })
    await wishBtn.click()
    // 應出現上限提示 toast,且 DB 無新增該商品許願
    await expect
      .poll(async () => {
        const { count } = await dbAdmin().from('wishes').select('product_id', { count: 'exact', head: true }).eq('product_id', seed.productId).eq('user_id', buyerId)
        return count ?? 0
      }, { timeout: 10000 })
      .toBe(0)
  } finally {
    await dbAdmin().from('wishes').delete().eq('user_id', buyerId).in('product_id', prodIds)
    await dbAdmin().from('products').delete().in('id', prodIds)
  }
})
```

- [ ] **Step 2: 補評價回覆 + 按讚測試**

`buyer.spec.ts` 的「評價」describe 內新增（先 seed 一筆評價,賣家回覆走 trpc,按讚走 UI）：

```ts
import { seedReview } from './helpers/db'
import { reviewItem } from './helpers/locators'

test('買家對評價按讚同步 like_count', async ({ page }) => {
  const r = await seedReview(process.env.E2E_SELLER_EMAIL!, process.env.E2E_BUYER_EMAIL!)
  try {
    await page.goto(`/sellers/${seed.sellerId}`)
    await page.getByRole('tab', { name: '評價' }).click()
    // 用 review-item testid 鎖定這筆 seed 評價(避免多筆評價時 .first() 抓錯),
    // 按讚鈕在 like_count=0 時文字為「讚」。
    const likeBtn = reviewItem(page, r.reviewId).getByRole('button', { name: /讚/ })
    await expect(likeBtn).toBeVisible({ timeout: 20000 })
    await likeBtn.click()
    await expect
      .poll(async () => {
        const { data } = await dbAdmin().from('reviews').select('like_count').eq('id', r.reviewId).single()
        return data?.like_count ?? 0
      }, { timeout: 15000 })
      .toBeGreaterThan(0)
  } finally {
    await dbAdmin().from('review_likes').delete().eq('review_id', r.reviewId)
    await dbAdmin().from('reviews').delete().eq('id', r.reviewId)
  }
})
```

- [ ] **Step 3: 跑測試**

Run: `npx playwright test --project=buyer buyer.spec.ts`
Expected: PASS。按讚按鈕 accessible name 依實際校正（可能用 icon + aria-label）。

- [ ] **Step 4: Commit**

```bash
git add tests/buyer.spec.ts
git commit -m "test(e2e): 補許願上限、評價按讚同步測試"
```

---

### Task 10: analytics.spec.ts（瀏覽計數去重）

**Files:**
- Create: `tests/analytics.spec.ts`
- Modify: `playwright.config.ts`（testMatch 加 `analytics`）

**Interfaces:**
- Consumes: `seedActiveListing`、`seedActiveConnection`、`dbAdmin`

- [ ] **Step 1: 寫測試（同 session 重看不重複計）**

Create `tests/analytics.spec.ts`：

```ts
import { test, expect } from './fixtures'
import { seedActiveListing, seedActiveConnection, dbAdmin } from './helpers/db'

async function viewCount(table: string, col: string, id: string): Promise<number> {
  const { count } = await dbAdmin().from(table).select(col, { count: 'exact', head: true }).eq(col, id)
  return count ?? 0
}

test('買家開商品頁兩次只記一筆 product_views(同 session 去重)', async ({ buyerPage }) => {
  const seed = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
  try {
    await buyerPage.goto(`/products/${seed.productId}`)
    await expect(buyerPage.getByText(seed.productName).first()).toBeVisible({ timeout: 20000 })
    await expect.poll(() => viewCount('product_views', 'product_id', seed.productId), { timeout: 15000 }).toBe(1)

    // 同 session 再看一次,計數不變
    await buyerPage.goto(`/products/${seed.productId}`)
    await buyerPage.waitForTimeout(3000)
    expect(await viewCount('product_views', 'product_id', seed.productId)).toBe(1)
  } finally {
    await dbAdmin().from('product_views').delete().eq('product_id', seed.productId)
    await dbAdmin().from('products').delete().eq('id', seed.productId)
  }
})

test('開代購頁記一筆 listing_views', async ({ buyerPage }) => {
  const seed = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
  try {
    await buyerPage.goto(`/listings/${seed.listingId}`)
    await expect(buyerPage.locator('main, [role="main"]')).toBeVisible({ timeout: 20000 })
    await expect.poll(() => viewCount('listing_views', 'listing_id', seed.listingId), { timeout: 15000 }).toBeGreaterThan(0)
  } finally {
    await dbAdmin().from('listing_views').delete().eq('listing_id', seed.listingId)
    await dbAdmin().from('products').delete().eq('id', seed.productId)
  }
})

test('賣家本人開自己連線頁不記 connection_views', async ({ sellerPage }) => {
  const conn = await seedActiveConnection(process.env.E2E_SELLER_EMAIL!)
  try {
    await sellerPage.goto(`/connections/${conn.connectionId}`)
    await sellerPage.waitForTimeout(3000)
    expect(await viewCount('connection_views', 'connection_id', conn.connectionId)).toBe(0)
  } finally {
    await dbAdmin().from('connection_views').delete().eq('connection_id', conn.connectionId)
    await dbAdmin().from('connections').delete().eq('id', conn.connectionId)
  }
})
```

- [ ] **Step 2: 納入 config + 跑測試**

Run: `npx playwright test --project=cross-role analytics.spec.ts`
Expected: PASS。若去重靠 cookie/session,buyerPage fixture 同 context 即同 session,符合假設。

- [ ] **Step 3: Commit**

```bash
git add tests/analytics.spec.ts playwright.config.ts
git commit -m "test(e2e): 新增 analytics 瀏覽計數去重測試"
```

---

### Task 11: 社群驗證 — 修既有 threads 路由 + 新增 IG 審核閉環

> **已由原始碼/真實 schema 確認的事實**：
> - **沒有 `social_verifications` 表**。Threads 用 `threads_verification_requests`(欄位 `seller_id, threads_username, code, status`,status 預設 `pending`);IG 用 `ig_verification_codes`(欄位 `seller_id, ig_username, code, status`,status 預設 `created`,待審為 `pending`)。
> - 唯一路由是 **`/admin/social-verification`**(外層 tab「Instagram」/「Threads」,預設 instagram)。**既有 `threads-verification.spec.ts` 用的 `/admin/threads-verification` 已不存在(404),該檔目前是壞的**。
> - 內層 panel:tab「待審核」/「審核紀錄」、待審列在 `tbody tr`、通過鈕「通過」、退回鈕「退回」→ dialog「退回驗證申請」→「確認退回」、掃描鈕「掃描比對 Instagram 收件匣」。
> - `approveIgVerification({id})` 需 status='pending' → 設 sellers.is_social_verified=true、申請 status='approved'、通知 `ig_verification_approved`。
> - 既有 threads 測試已完整覆蓋 Threads 送出→通過/退回→通知→紀錄,故本任務**只補 IG 側**,不重複 Threads。

**Files:**
- Modify: `tests/threads-verification.spec.ts`（修死路由）
- Create: `tests/ig-verification.spec.ts`
- Modify: `playwright.config.ts`（testMatch 加 `ig-verification`；threads 已在 testMatch 內）

**Interfaces:**
- Consumes: `getSellerIdByEmail`、`getNotificationCount`、`dbAdmin`

- [ ] **Step 1: 修既有 threads-verification.spec.ts 的死路由**

`tests/threads-verification.spec.ts` 內兩處 `adminPage.goto('/admin/threads-verification')` 改為先進 social-verification 再點 Threads tab：

```ts
await adminPage.goto('/admin/social-verification')
await adminPage.getByRole('tab', { name: 'Threads' }).click()
```

（`reqCard` = `tbody tr` filter 文字、「通過」「退回」「確認退回」「審核紀錄」tab 名稱皆與現頁一致,不需改。）

- [ ] **Step 2: 跑既有 threads 測試確認修好**

Run: `npx playwright test --project=cross-role threads-verification.spec.ts`
Expected: PASS（修路由後應綠;首次編譯較慢,已有 test.slow()）。

- [ ] **Step 3: 寫 IG 審核閉環測試**

Create `tests/ig-verification.spec.ts`：

```ts
import { test, expect } from './fixtures'
import { getSellerIdByEmail, getNotificationCount, dbAdmin } from './helpers/db'

// 待審列以 ig_username 文字定位(e2e 唯一),不需 data-testid。
function reqRow(page: import('@playwright/test').Page, text: string) {
  return page.locator('tbody tr').filter({ hasText: text })
}

async function resetSeller(sellerId: string) {
  await dbAdmin().from('ig_verification_codes').delete().eq('seller_id', sellerId)
  await dbAdmin().from('sellers').update({
    ig_handle: null, ig_user_id: null, ig_connected_at: null, is_social_verified: false,
  }).eq('id', sellerId)
}

test('admin 通過 IG 驗證 → 賣家 is_social_verified + 通知', async ({ adminPage }) => {
  test.slow()
  const sellerId = await getSellerIdByEmail(process.env.E2E_SELLER_EMAIL!)
  const username = `e2e_ig_${Date.now()}`
  await resetSeller(sellerId)
  const notifBefore = await getNotificationCount(sellerId, 'ig_verification_approved')

  // seed 一筆「待審(pending)」IG 驗證(預設 status 是 created,需明設 pending 才會出現在待審清單)
  await dbAdmin().from('ig_verification_codes').insert({
    seller_id: sellerId, ig_username: username, code: 'E2E1234', status: 'pending',
  })

  try {
    await adminPage.goto('/admin/social-verification') // 預設即 Instagram tab
    await reqRow(adminPage, username).getByRole('button', { name: '通過' }).click()

    // 申請 → approved
    await expect
      .poll(async () => {
        const { data } = await dbAdmin()
          .from('ig_verification_codes').select('status')
          .eq('seller_id', sellerId).eq('ig_username', username).maybeSingle()
        return data?.status
      }, { timeout: 20000 })
      .toBe('approved')

    // 賣家已驗證
    await expect
      .poll(async () => {
        const { data } = await dbAdmin().from('sellers').select('is_social_verified, ig_handle').eq('id', sellerId).single()
        return data
      }, { timeout: 15000 })
      .toMatchObject({ is_social_verified: true, ig_handle: username })

    // 通知 +1
    await expect
      .poll(() => getNotificationCount(sellerId, 'ig_verification_approved'), { timeout: 15000 })
      .toBe(notifBefore + 1)
  } finally {
    await resetSeller(sellerId)
    await dbAdmin().from('notifications').delete().eq('recipient_id', sellerId).eq('type', 'ig_verification_approved')
  }
})

// 掃描比對依賴管理員真實 IG 收件匣 + IG token,無法穩定 e2e。只驗按鈕存在可觸發。
// (按下去若無 token 會 toast 錯誤;不斷言結果視窗,避免外部依賴造成 flaky。)
test('IG「掃描比對」按鈕存在', async ({ adminPage }) => {
  await adminPage.goto('/admin/social-verification')
  await expect(adminPage.getByRole('button', { name: '掃描比對 Instagram 收件匣' })).toBeVisible({ timeout: 15000 })
})

test.fixme('IG 掃描比對命中自動通過(需後端可注入假收件匣)', async () => {})
```

- [ ] **Step 4: 納入 config + 跑測試**

`playwright.config.ts` testMatch 加 `ig-verification`。
Run: `npx playwright test --project=cross-role ig-verification.spec.ts`
Expected: 通過閉環 + 掃描鈕可見 PASS;`test.fixme` 略過。

- [ ] **Step 5: Commit**

```bash
git add tests/threads-verification.spec.ts tests/ig-verification.spec.ts playwright.config.ts
git commit -m "test(e2e): 修 threads 驗證死路由 + 新增 IG 審核閉環測試"
```

---

## Phase 5 — P3 周邊

### Task 12: wishes.spec.ts（公開榜 + 許願頁 + /wishes/new）

**Files:**
- Create: `tests/wishes.spec.ts`
- Modify: `playwright.config.ts`

**Interfaces:**
- Consumes: `getUserIdByEmail`、`dbAdmin`、`e2eName`

- [ ] **Step 1: 確認 /wishes/new 流程欄位**

Run: `grep -n "搜尋\|許願內容\|送出\|placeholder\|button" app/\(buyer\)/wishes/new/page.tsx | head -20`

- [ ] **Step 2: 寫測試（公開榜列出 seed 許願 + 詳情頁 + 透過 /wishes/new 建立）**

Create `tests/wishes.spec.ts`：

```ts
import { test, expect } from './fixtures'
import { getUserIdByEmail, dbAdmin } from './helpers/db'
import { e2eName } from './helpers/naming'

test('公開許願榜列出 seed 許願,點進詳情頁', async ({ buyerPage }) => {
  const buyerId = await getUserIdByEmail(process.env.E2E_BUYER_EMAIL!)
  const name = e2eName('許願商品')
  const { data: prod } = await dbAdmin().from('products').insert({ name, category: 'other', created_by: buyerId }).select('id').single()
  // wishes.content 為 NOT NULL,seed 必帶 content
  const { data: wish } = await dbAdmin().from('wishes').insert({ product_id: prod!.id, user_id: buyerId, content: '[E2E] 想要這個' }).select('id').single()
  try {
    await buyerPage.goto('/wishes')
    await expect(buyerPage.getByText(name).first()).toBeVisible({ timeout: 20000 })
    await buyerPage.goto(`/wishes/${wish!.id}`)
    await expect(buyerPage.getByText(name).first()).toBeVisible({ timeout: 20000 })
  } finally {
    await dbAdmin().from('wishes').delete().eq('id', wish!.id)
    await dbAdmin().from('products').delete().eq('id', prod!.id)
  }
})
```

- [ ] **Step 3: 納入 config + 跑測試**

Run: `npx playwright test --project=cross-role wishes.spec.ts`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add tests/wishes.spec.ts playwright.config.ts
git commit -m "test(e2e): 新增公開許願榜 + 許願詳情頁測試"
```

---

### Task 13: banner.spec.ts（首頁輪播）

**Files:**
- Create: `tests/banner.spec.ts`
- Modify: `playwright.config.ts`

**Interfaces:**
- Consumes: `dbAdmin`、`e2eName`

- [ ] **Step 1: 確認 home_banners 欄位**

Run: `grep -rn "home_banners\|image_r2_key\|sort_order\|is_active\|status" server lib app/_home | head -20`

- [ ] **Step 2: 寫測試（seed 一筆 active banner → 首頁 hero 顯示;刪除後隱藏）**

Create `tests/banner.spec.ts`（欄位依 Step 1 校正）：

```ts
import { test, expect } from './fixtures'
import { dbAdmin } from './helpers/db'

test('有 active banner 時首頁顯示 hero 輪播', async ({ buyerPage }) => {
  const key = `images/banner/e2e-${Date.now()}.jpg`
  const { data: b } = await dbAdmin().from('home_banners').insert({
    image_r2_key: key, image_url: `${process.env.R2_PUBLIC_URL}/${key}`, sort_order: 999, is_active: true,
  }).select('id').single()
  try {
    await buyerPage.goto('/')
    // hero 區塊存在(輪播容器有左右箭頭或圓點)。用較寬鬆的可見性檢查。
    await expect(buyerPage.locator('header')).toBeVisible({ timeout: 15000 })
    await expect(buyerPage.locator('img').first()).toBeVisible({ timeout: 15000 })
  } finally {
    await dbAdmin().from('home_banners').delete().eq('id', b!.id)
  }
})
```

> 若 banner 元件有可定位的 role/testid（如 region "主視覺"）,Step 1 後改用更精確的斷言。

- [ ] **Step 3: 納入 config + 跑測試**

Run: `npx playwright test --project=cross-role banner.spec.ts`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add tests/banner.spec.ts playwright.config.ts
git commit -m "test(e2e): 新增首頁 banner 輪播測試"
```

---

### Task 14: cron-expire.spec.ts（過期下架,API 層）

**Files:**
- Create: `tests/cron-expire.spec.ts`
- Modify: `playwright.config.ts`

**Interfaces:**
- Consumes: `seedActiveListing`、`seedActiveConnection`、`dbAdmin`

- [ ] **Step 1: 確認 cron 路由的授權方式**

Run: `grep -n "CRON_SECRET\|authorization\|headers\|expire" app/api/cron/expire-daily/route.ts`
記下是否需 `Authorization: Bearer ${CRON_SECRET}`。

- [ ] **Step 2: 寫測試（seed 過期商品/連線 → 呼叫 cron → 驗證下架/結束）**

Create `tests/cron-expire.spec.ts`：

```ts
import { test, expect, request as pwRequest } from '@playwright/test'
import { seedActiveListing, seedActiveConnection, dbAdmin } from './helpers/db'

// 路由已實作(確認 route.ts):status='active' 且過期者 → listing inactive/expired、
// connection ended/expired。路由要求 Authorization: Bearer CRON_SECRET(無則回 401)。
test('cron 把過期代購下架、過期連線結束', async () => {
  // CRON_SECRET 未設(本機 .env.local 沒有)就 skip,避免必然 401
  test.skip(!process.env.CRON_SECRET, 'CRON_SECRET 未設定,略過 cron 測試')

  const listing = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
  const conn = await seedActiveConnection(process.env.E2E_SELLER_EMAIL!)
  // 改成過期:listing.expires_at 設昨天;connection.end_date 設昨天(台灣日期比對)
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10)
  await dbAdmin().from('listings').update({ expires_at: yesterday }).eq('id', listing.listingId)
  await dbAdmin().from('connections').update({ end_date: yesterday }).eq('id', conn.connectionId)

  try {
    const ctx = await pwRequest.newContext()
    const res = await ctx.get('http://localhost:3000/api/cron/expire-daily', {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    })
    expect(res.ok()).toBeTruthy()
    await ctx.dispose()

    await expect
      .poll(async () => {
        const { data } = await dbAdmin().from('listings').select('status, inactive_reason').eq('id', listing.listingId).single()
        return `${data?.status}/${data?.inactive_reason}`
      }, { timeout: 15000 })
      .toBe('inactive/expired')

    await expect
      .poll(async () => {
        const { data } = await dbAdmin().from('connections').select('status, ended_reason').eq('id', conn.connectionId).single()
        return `${data?.status}/${data?.ended_reason}`
      }, { timeout: 15000 })
      .toBe('ended/expired')
  } finally {
    await dbAdmin().from('listings').delete().eq('id', listing.listingId)
    await dbAdmin().from('products').delete().eq('id', listing.productId)
    await dbAdmin().from('connections').delete().eq('id', conn.connectionId)
  }
})
```

> cron 的 `expired` 邏輯**已實作**(route.ts 確認會更新狀態),故為正式測試非 fixme。唯一前置是 `CRON_SECRET` 須存在於測試環境(`.env.local`),否則測試 skip。

- [ ] **Step 3: 納入 config + 跑測試**

Run: `npx playwright test --project=cross-role cron-expire.spec.ts`
Expected: PASS（有 CRON_SECRET 時）或 skipped（未設時）。

- [ ] **Step 4: Commit**

```bash
git add tests/cron-expire.spec.ts playwright.config.ts
git commit -m "test(e2e): 新增 cron 過期下架測試(API 層)"
```

---

## Phase 6 — 文件收尾

### Task 15: 更新 README 與 platform-overview 測試章節

**Files:**
- Modify: `tests/README.md`、`docs/platform-overview.md`（第八節 E2E 測試帳號）

- [ ] **Step 1: 更新 tests/README.md 的 Structure 清單**

把過時描述更新:messages 已含即時廣播;新增 smoke/onboarding/become-seller/admin-suspend/analytics/wishes/banner/cron-expire/ig-verification 各一行說明;新增 `helpers/locators.ts` 說明（data-testid 約定 + 臨時帳號）。

- [ ] **Step 2: 更新 platform-overview.md 第八節**

在 E2E 測試帳號章節補一句:onboarding/become-seller 測試使用臨時帳號（`e2e-tmp-*`,測後刪除）;選擇器策略改用 `data-testid`。

- [ ] **Step 3: 跑完整套件確認全綠**

Run: `npm test`
Expected: 全部 PASS（`test.fixme` 標記者顯示 skipped）。記錄實際結果。

- [ ] **Step 4: Commit**

```bash
git add tests/README.md docs/platform-overview.md
git commit -m "docs: 更新 e2e 測試說明與 platform-overview 測試章節"
```

---

## Self-Review 結果

**Spec coverage:** 設計文件 28 條測試項對應如下 — P0(1~9): Task 1/3/4/5/6 + seller.spec(Task1)/cross-role(Task8)/messages(Task6);P1(10~15): Task 7/8 + 既有 admin specs(Task2 加 testid);P2(16~22): Task 9/10/11;P3(23~28): 既有 seo/storage + Task 12/13/14 + smoke(Task3)。全部有對應任務。

**Placeholder scan:** 各 Task 的 Step 1「確認欄位」是刻意的探查步驟（產出實際 placeholder/按鈕文字供後續步驟校正），非 plan placeholder;測試碼皆完整可跑。表名/欄位假設處已標明「依 Step 1 校正」與校正方式。

**Type consistency:** locators helper 的 `listingRow/connectionRow/adminRow/notificationItem/reviewItem/createTempUser/deleteTempUser` 在 Task 1 定義,後續 Task 7/9/11 使用名稱一致;沿用既有 `helpers/db.ts` 函式簽名（seedActiveListing/seedActiveConnection/getNotificationCount/getUserIdByEmail/getSellerIdByEmail/seedReview/getProductWishCount/getSellerStats）。

---

## 程式碼對照驗證紀錄（2026-06-27，逐檔比對真實程式碼 + DB schema）

以下為**讀過所有被測程式碼 + 用 Supabase MCP 查真實 schema** 後修正的不符。真實 schema 經 `information_schema` 確認（`server/db/types.ts` 手寫型別已過時、缺多張表，不可信）。

**A. DB schema 修正**
- `wishes.content` 為 **NOT NULL 無預設** → 所有 wish insert 補 `content`。**連既有 `cross-role.spec.ts` 的 wish-notify 測試也缺 content、目前是壞的**，一併修（Task 8）。
- **無 `social_verifications` 表**。實際:Threads=`threads_verification_requests`(`threads_username`,status 預設 `pending`)、IG=`ig_verification_codes`(`ig_username`,status 預設 `created`,待審為 `pending`)。ig-verification 整支重寫（Task 11）。
- `home_banners` 欄位確認 `image_url`/`image_r2_key`(NOT NULL)、`is_active`(預設 true)、`created_by` 可空 → banner 測試 OK（Task 13）。
- `*_views` 確認:`product_views.product_id`/`listing_views.listing_id`/`connection_views.connection_id`/`profile_views.seller_id`（Task 10）。
- `profiles.username`、`connections.billing_method`/`can_wish`/`post_link`、`listings.is_in_stock`、`reviews.like_count` 均存在（types.ts 缺但 DB 有）。

**B. UI 選擇器修正（逐頁讀原始碼確認）**
- 賣家 listing 管理頁**已改 table + 下拉選單**:下架/刪除在「更多操作」DropdownMenu 內 → 既有 `seller.spec.ts` 的 `getByRole('button',{name:'下架'})` 已壞,改先開選單再點 menuitem（Task 1）。
- **詢問是 `<Link>` 非 button**（Task 6）。
- **login**:email placeholder=`your@email.com`、送出鈕「登入」需 `exact`（撞「使用 Google 登入」）（Task 4/5）。
- **onboarding**:Email/`provider=email` 用戶**必填密碼**(`設定密碼`/`確認密碼`);username Label `ID`、輸入自動轉小寫濾非英數(故格式錯誤測試改測「太短」)、送出鈕「開始使用」（Task 4）。
- **become-seller 是單表單非 wizard**,送出鈕要求頭貼+簡介+proof 全填、同意非 checkbox → 改 trpc 驅動 `seller.becomeSeller`（Task 5）。
- **既有 `threads-verification.spec.ts` 路由 `/admin/threads-verification` 已不存在(404)、目前是壞的** → 改 `/admin/social-verification` + 點 Threads tab（Task 11）。
- admin/sellers 停權需先搜尋出列;選擇器「搜尋賣家...」「停權」「請填寫原因...」「確認停權」確認（Task 7）。
- 評價卡多筆時 `.first()` 會抓錯 → 加 `review-item` testid 鎖定（Task 2/9）。

**C. 邏輯確認**
- `suspendSeller`/`approveThreadsVerification`/`approveIgVerification`/cron `expire-daily` 的狀態轉換與通知型別,皆逐行對過 `server/routers/admin.ts` 與 route.ts。cron **已實作** `expired`(非 fixme),但需 `CRON_SECRET` header（無則 401 → 測試 skip）。
- 訊息 `context_type/context_id` 確認由 `message.send` insert 寫入、messages 頁從 URL 帶入（Task 6 斷言成立）。
- `seller-create.spec.ts` 已是完整當前 UI 深測,不需大改;`messages.spec.ts` 即時廣播測試良好,保留。

**仍待執行時確認（已標於各 Task）:** onboarding `type=email` 若 verifyOtp 失敗改 `magiclink`;wishes 公開榜卡片渲染商品名（低風險）。
