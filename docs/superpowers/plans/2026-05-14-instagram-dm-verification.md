# Instagram DM 驗證綁定 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以 DM 驗證取代 IG OAuth 綁定——使用者輸入 IG 帳號、收到 4 碼數字、私訊給管理員帳號，系統透過 Meta webhook 比對後完成綁定。

**Architecture:** 前端產生驗證碼 → 使用者 DM 管理員帳號 → Meta Webhook 觸發 → 後端查詢 IG API 取得寄件者帳號 → 比對 code → 更新 sellers 表。前端每 3 秒 polling status endpoint 偵測完成。

**Tech Stack:** Next.js 15 App Router, Supabase (PostgreSQL), Meta Instagram Graph API (Messaging), TypeScript

---

## File Map

**Create:**
- `supabase/migrations/00029_ig_dm_verification.sql`
- `app/api/instagram/verify/start/route.ts`
- `app/api/instagram/verify/status/route.ts`
- `app/api/webhooks/instagram/route.ts`

**Modify:**
- `.env.local` — 新增 3 個 env vars（手動，不 commit）
- `server/db/types.ts` — 在 Seller 型別加 `ig_user_id`、`ig_connected_at`
- `app/(seller)/dashboard/profile/page.tsx` — 替換 IG 連結 UI

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/00029_ig_dm_verification.sql`

- [ ] **Step 1: 寫 migration 檔**

```sql
-- sellers 加上 ig_user_id（Meta 永久識別碼）與 ig_connected_at（若尚未有的話）
ALTER TABLE sellers
  ADD COLUMN IF NOT EXISTS ig_user_id      text,
  ADD COLUMN IF NOT EXISTS ig_connected_at timestamptz;

-- 驗證碼表
CREATE TABLE ig_verification_codes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   uuid        NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  ig_username text        NOT NULL,
  code        text        NOT NULL,
  expires_at  timestamptz NOT NULL,
  verified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ig_verification_codes ENABLE ROW LEVEL SECURITY;
-- 不建立任何 anon/authenticated policy，確保前端完全無法直接存取
```

- [ ] **Step 2: 套用 migration**

透過 Supabase MCP 工具執行：`mcp__supabase__apply_migration`

或在 terminal：
```bash
npx supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00029_ig_dm_verification.sql
git commit -m "feat: add ig_verification_codes table and ig_user_id/ig_connected_at to sellers"
```

---

## Task 2: 更新 Seller 型別

**Files:**
- Modify: `server/db/types.ts`

- [ ] **Step 1: 在 `Seller` 型別加入新欄位**

在 `server/db/types.ts` 的 `Seller` 型別內，`ig_handle` 那一行旁邊加入：

```typescript
  ig_user_id: string | null
  ig_connected_at: string | null
```

加完後 Seller 相關欄位應如下：

```typescript
export type Seller = {
  id: string
  name: string
  phone_number: string
  phone_verified: boolean
  ig_handle: string | null
  ig_user_id: string | null          // 新增
  ig_connected_at: string | null     // 新增
  threads_handle: string | null
  ig_follower_count: number | null
  threads_follower_count: number | null
  social_connected_at: string | null
  is_social_verified: boolean
  is_suspended: boolean
  suspended_at: string | null
  avg_rating: number | null
  review_count: number
  follow_count: number
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Commit**

```bash
git add server/db/types.ts
git commit -m "feat: add ig_user_id and ig_connected_at to Seller type"
```

---

## Task 3: 新增 Env Variables

**Files:**
- Modify: `.env.local`（手動新增，不 commit）

- [ ] **Step 1: 在 `.env.local` 加入以下四個變數**

```
# Instagram DM Verification
INSTAGRAM_ADMIN_TOKEN=           # 管理員 IG 帳號的 long-lived access token
INSTAGRAM_ADMIN_ACCOUNT_ID=      # 管理員 IG 帳號的 account ID（數字）
NEXT_PUBLIC_INSTAGRAM_ADMIN_HANDLE=   # 管理員 IG 帳號名稱（不含 @），顯示給使用者
INSTAGRAM_WEBHOOK_SECRET=        # 自訂字串，要跟 Meta webhook console 填的 verify token 一致
```

注意：`INSTAGRAM_CLIENT_SECRET` 已存在於 `.env.local`，webhook POST 的簽章驗證會直接複用它。

---

## Task 4: `POST /api/instagram/verify/start`

**Files:**
- Create: `app/api/instagram/verify/start/route.ts`

- [ ] **Step 1: 建立 route 檔案**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getDb } from '@/server/db/client'

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const igUsername: string = (body.ig_username ?? '').trim().toLowerCase()
  if (!igUsername || !/^[a-z0-9._]{1,30}$/.test(igUsername)) {
    return NextResponse.json({ error: 'Invalid Instagram username' }, { status: 400 })
  }

  const db = getDb()

  // 清除此 seller 既有的未驗證碼
  await db
    .from('ig_verification_codes')
    .delete()
    .eq('seller_id', user.id)
    .is('verified_at', null)

  const code = String(Math.floor(1000 + Math.random() * 9000))
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  const { data, error } = await db
    .from('ig_verification_codes')
    .insert({
      seller_id: user.id,
      ig_username: igUsername,
      code,
      expires_at: expiresAt.toISOString(),
    })
    .select('id, code, expires_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create code' }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/instagram/verify/start/route.ts
git commit -m "feat: add instagram verify/start endpoint"
```

---

## Task 5: `GET /api/instagram/verify/status`

**Files:**
- Create: `app/api/instagram/verify/status/route.ts`

- [ ] **Step 1: 建立 route 檔案**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getDb } from '@/server/db/client'

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const db = getDb()
  const { data } = await db
    .from('ig_verification_codes')
    .select('verified_at, ig_username, expires_at')
    .eq('id', id)
    .eq('seller_id', user.id)
    .single()

  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (data.verified_at) {
    return NextResponse.json({ verified: true, ig_handle: data.ig_username })
  }

  if (new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ verified: false, expired: true })
  }

  return NextResponse.json({ verified: false })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/instagram/verify/status/route.ts
git commit -m "feat: add instagram verify/status polling endpoint"
```

---

## Task 6: `POST + GET /api/webhooks/instagram`

**Files:**
- Create: `app/api/webhooks/instagram/route.ts`

- [ ] **Step 1: 建立 webhook handler**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { getDb } from '@/server/db/client'

// GET: Meta webhook 訂閱驗證（hub.challenge）
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.INSTAGRAM_WEBHOOK_SECRET) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// POST: Meta 推送新訊息
export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // 驗證 Meta 簽章
  const signature = request.headers.get('x-hub-signature-256')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 403 })
  }
  const expected =
    'sha256=' +
    createHmac('sha256', process.env.INSTAGRAM_CLIENT_SECRET!)
      .update(rawBody)
      .digest('hex')
  if (signature !== expected) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const entries = (payload as { entry?: unknown[] }).entry ?? []
  for (const entry of entries) {
    const messaging = (entry as { messaging?: unknown[] }).messaging ?? []
    for (const event of messaging) {
      const e = event as {
        sender?: { id: string }
        message?: { text?: string }
      }
      const senderIgsid = e.sender?.id
      const text = e.message?.text?.trim()
      if (!senderIgsid || !text) continue
      if (!/^\d{4}$/.test(text)) continue  // 只處理 4 碼數字
      await verifyCode(senderIgsid, text)
    }
  }

  // Meta 要求固定回 200，否則會重試
  return NextResponse.json({ ok: true })
}

async function verifyCode(senderIgsid: string, code: string): Promise<void> {
  // 向 IG API 查詢寄件者的 username
  const profileResp = await fetch(
    `https://graph.instagram.com/${senderIgsid}?fields=username&access_token=${process.env.INSTAGRAM_ADMIN_TOKEN}`
  )
  if (!profileResp.ok) return

  const profile = await profileResp.json()
  const igUsername: string = (profile.username ?? '').toLowerCase()
  if (!igUsername) return

  const db = getDb()

  // 找符合 username + code 且未過期、未驗證的紀錄
  const { data: codeRow } = await db
    .from('ig_verification_codes')
    .select('id, seller_id')
    .eq('ig_username', igUsername)
    .eq('code', code)
    .is('verified_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (!codeRow) return

  // 綁定：更新 sellers + 標記 code 已驗證
  await Promise.all([
    db
      .from('sellers')
      .update({
        ig_handle: igUsername,
        ig_user_id: senderIgsid,
        ig_connected_at: new Date().toISOString(),
        is_social_verified: true,
      })
      .eq('id', codeRow.seller_id),

    db
      .from('ig_verification_codes')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', codeRow.id),
  ])
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/webhooks/instagram/route.ts
git commit -m "feat: add instagram dm webhook handler"
```

---

## Task 7: Frontend — 替換 IG 連結 UI

**Files:**
- Modify: `app/(seller)/dashboard/profile/page.tsx`

- [ ] **Step 1: 加入 `useRef` import**

在檔案最頂端，找到：
```typescript
import { useState, useEffect } from 'react'
```
改為：
```typescript
import { useState, useEffect, useRef } from 'react'
```

- [ ] **Step 2: 在 component 裡宣告 IG 驗證狀態與 handlers**

在 `const [isSubmitting, setIsSubmitting] = useState(false)` 下方加入：

```typescript
// IG DM 驗證狀態機
type IgVerifyState =
  | { step: 'idle' }
  | { step: 'entering_username' }
  | { step: 'loading_code' }
  | { step: 'showing_code'; id: string; code: string }
  | { step: 'polling'; id: string; code: string }
  | { step: 'success' }

const [igVerify, setIgVerify] = useState<IgVerifyState>({ step: 'idle' })
const [igUsernameInput, setIgUsernameInput] = useState('')
const [igInputError, setIgInputError] = useState('')
const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
const adminHandle = process.env.NEXT_PUBLIC_INSTAGRAM_ADMIN_HANDLE ?? ''

const handleIgVerifyStart = async () => {
  const username = igUsernameInput.trim().toLowerCase()
  if (!username) {
    setIgInputError('請輸入 IG 帳號')
    return
  }
  setIgInputError('')
  setIgVerify({ step: 'loading_code' })
  try {
    const res = await fetch('/api/instagram/verify/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ig_username: username }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    setIgVerify({ step: 'showing_code', id: data.id, code: data.code })
  } catch {
    toast.error('產生驗證碼失敗，請重試')
    setIgVerify({ step: 'entering_username' })
  }
}

const startPolling = (id: string, code: string) => {
  setIgVerify({ step: 'polling', id, code })
  pollingRef.current = setInterval(async () => {
    try {
      const res = await fetch(`/api/instagram/verify/status?id=${id}`)
      const data = await res.json()
      if (data.verified) {
        clearInterval(pollingRef.current!)
        pollingRef.current = null
        setIgVerify({ step: 'success' })
        toast.success('Instagram 已成功連結')
        void refetchSeller()
      } else if (data.expired) {
        clearInterval(pollingRef.current!)
        pollingRef.current = null
        toast.error('驗證碼已過期，請重試')
        setIgVerify({ step: 'idle' })
      }
    } catch { /* 靜默，下次 interval 再試 */ }
  }, 3000)
}

const cancelIgVerify = () => {
  if (pollingRef.current) {
    clearInterval(pollingRef.current)
    pollingRef.current = null
  }
  setIgVerify({ step: 'idle' })
  setIgUsernameInput('')
  setIgInputError('')
}
```

- [ ] **Step 3: 在 useEffect 加入 cleanup**

找到已有的空 cleanup useEffect，或在 component 裡加入：

```typescript
useEffect(() => {
  return () => {
    if (pollingRef.current) clearInterval(pollingRef.current)
  }
}, [])
```

- [ ] **Step 4: 替換 Instagram 「未連結」區塊**

找到這段（Instagram 未連結的 dashed border div）：

```tsx
) : (
  <div className="flex items-start gap-3 rounded-md border border-dashed p-4">
    <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
    <p className="flex-1 text-sm text-muted-foreground">
      連結後帳號名稱與粉絲數將顯示在賣家頁面
    </p>
    <Button size="sm" className="flex-shrink-0" render={<a href="/api/auth/instagram/connect" />}>
      <Link2 className="mr-1 h-3.5 w-3.5" />連結
    </Button>
  </div>
)}
```

整段替換為：

```tsx
) : (
  <>
    {igVerify.step === 'idle' && (
      <div className="flex items-start gap-3 rounded-md border border-dashed p-4">
        <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="flex-1 text-sm text-muted-foreground">連結後帳號名稱與粉絲數將顯示在賣家頁面</p>
        <Button size="sm" className="flex-shrink-0" onClick={() => setIgVerify({ step: 'entering_username' })}>
          <Link2 className="mr-1 h-3.5 w-3.5" />連結
        </Button>
      </div>
    )}

    {igVerify.step === 'entering_username' && (
      <div className="rounded-md border p-4 space-y-3">
        <p className="text-sm text-muted-foreground">輸入你的 Instagram 帳號</p>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="帳號名稱（不含 @）"
              value={igUsernameInput}
              onChange={(e) => { setIgUsernameInput(e.target.value); setIgInputError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleIgVerifyStart() }}
              aria-invalid={!!igInputError}
            />
            <FormFieldError message={igInputError} />
          </div>
          <Button size="sm" onClick={() => void handleIgVerifyStart()}>取得驗證碼</Button>
          <Button size="sm" variant="ghost" onClick={cancelIgVerify}>取消</Button>
        </div>
      </div>
    )}

    {igVerify.step === 'loading_code' && (
      <div className="flex items-center gap-2 rounded-md border p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">產生驗證碼中...</span>
      </div>
    )}

    {(igVerify.step === 'showing_code' || igVerify.step === 'polling') && (
      <div className="rounded-md border p-4 space-y-3">
        <p className="text-sm font-medium">
          請用 Instagram 私訊以下數字給{' '}
          <span className="font-mono font-semibold">@{adminHandle}</span>
        </p>
        <p className="text-3xl font-mono font-bold tracking-[0.3em] text-center py-2">
          {igVerify.code}
        </p>
        <p className="text-xs text-muted-foreground text-center">驗證碼 15 分鐘內有效</p>
        {igVerify.step === 'showing_code' ? (
          <Button
            className="w-full"
            onClick={() => startPolling(igVerify.id, igVerify.code)}
          >
            我已傳送，等待確認
          </Button>
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            等待確認中...
          </div>
        )}
        <Button variant="ghost" size="sm" className="w-full" onClick={cancelIgVerify}>
          取消
        </Button>
      </div>
    )}

    {igVerify.step === 'success' && (
      <div className="rounded-md border bg-green-50 p-4 text-sm text-green-700 dark:bg-green-950 dark:text-green-400">
        Instagram 已成功連結！
      </div>
    )}
  </>
)}
```

- [ ] **Step 5: 替換「重新連結」按鈕**

找到 Instagram 已連結狀態裡的「重新連結」按鈕：

```tsx
<Button variant="outline" size="sm" render={<a href="/api/auth/instagram/connect" />}>
  <Link2 className="mr-1 h-3.5 w-3.5" />重新連結
</Button>
```

改為：

```tsx
<Button variant="outline" size="sm" onClick={() => setIgVerify({ step: 'entering_username' })}>
  <Link2 className="mr-1 h-3.5 w-3.5" />重新連結
</Button>
```

- [ ] **Step 6: Commit**

```bash
git add app/(seller)/dashboard/profile/page.tsx
git commit -m "feat: replace instagram oauth with dm verification flow in profile UI"
```

---

## Task 8: 更新 `disconnectSocial` 清除 `ig_user_id`

**Files:**
- Modify: `server/routers/seller.ts`

- [ ] **Step 1: 在 `disconnectSocial` 的 instagram 分支加入 `ig_user_id: null`**

找到：
```typescript
if (input.platform === 'instagram') {
  clearData.ig_handle = null
  clearData.ig_follower_count = null
  clearData.ig_connected_at = null
}
```

改為：
```typescript
if (input.platform === 'instagram') {
  clearData.ig_handle = null
  clearData.ig_user_id = null
  clearData.ig_follower_count = null
  clearData.ig_connected_at = null
}
```

- [ ] **Step 2: Commit**

```bash
git add server/routers/seller.ts
git commit -m "fix: clear ig_user_id on instagram disconnect"
```

---

## Task 9: Meta Developer Console 設定（手動）

這一步無法用程式碼完成，需要你自己操作。

- [ ] **Step 1: 在 Meta Developer Console 設定 Webhook**
  1. 進入 [developers.facebook.com](https://developers.facebook.com) → 你的 App
  2. 左側選 **Instagram** → **Webhooks**
  3. 新增 webhook：
     - **Callback URL**: `https://你的domain/api/webhooks/instagram`
     - **Verify Token**: 填入與 `INSTAGRAM_WEBHOOK_SECRET` 相同的字串
  4. 訂閱 **messages** 欄位

- [ ] **Step 2: 取得管理員帳號 Token**
  1. 在 Meta Developer Console → **Tools** → **Graph API Explorer**
  2. 選你的 App，選你的 IG Business 帳號
  3. 加上 `instagram_manage_messages` 權限
  4. 產生 Long-lived Token（或設定 System User Token 永不過期）
  5. 填入 `.env.local` 的 `INSTAGRAM_ADMIN_TOKEN`

- [ ] **Step 3: 取得管理員帳號 ID**
  1. 呼叫 `GET https://graph.instagram.com/me?fields=id&access_token={INSTAGRAM_ADMIN_TOKEN}`
  2. 回傳的 `id` 填入 `INSTAGRAM_ADMIN_ACCOUNT_ID`
