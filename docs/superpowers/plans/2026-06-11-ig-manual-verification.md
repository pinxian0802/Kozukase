# IG 驗證改造（自動為主、人工為輔）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Instagram 驗證從純自動掃收件匣，改成「自動為主、人工為輔」的混合流程，並把 IG/Threads 後台合併成「社群驗證」一頁。

**Architecture:** 擴充現有 `ig_verification_codes` 表承載審核狀態；後端 API 新增「我已傳送」(`sent`) 與「落人工」(`escalate`) 兩個轉態端點；前台把 profile 與 become-seller 重複的驗證邏輯抽成共用 `useIgVerification` hook + 卡片元件；後台比照 Threads 新增四支 admin procedure，並把兩個驗證後台合併為分頁。

**Tech Stack:** Next.js App Router、tRPC、Supabase（service-role client `getDb()`）、Playwright（E2E）。

**規格來源：** `docs/specs/2026-06-11-ig-manual-verification-design.md`

---

## 測試策略（重要，偏離標準 TDD）

本專案**只有 Playwright E2E**（`npm test`），無單元測試框架；且依專案慣例，使用者偏好手動驗證、**不主動跑 E2E**。因此本計畫各任務的驗證手段為：

1. `npm run build`（或 `npx tsc --noEmit`）確認型別與編譯通過；
2. `npm run lint`；
3. dev server 手動點測（步驟會寫明）。

標準 TDD 紅綠循環在此不適用，請勿為此新增單元測試框架。

## 專案前提

- 主程式碼在 `Kozukase/`；所有路徑相對於此目錄。
- **非 git repo**：計畫不含 `git commit` 步驟；如使用者要求再處理版本控制。
- **資料庫變更**：依專案慣例，migration 寫好後用 **Supabase MCP `apply_migration`** 套用到實際資料庫（見 Task 1 Step 3）。
- 完成後依慣例更新 `docs/platform-overview.md`（Task 9）。

## 狀態對應（全程一致，後續任務共用此命名）

| DB `status` | 前台 step | 說明 |
|---|---|---|
| `created` | `waiting_send` | 產碼、未按「我已傳送」；`expires_at` 有效，15 分倒數 |
| `sent` | `polling` | 按了「我已傳送」；`expires_at=null`（凍結），自動掃中 |
| `pending` | `reviewing` | 自動掃 5 次未中，落人工待審 |
| `approved` | `success` | 自動 (`source=auto`) 或人工 (`source=manual`) 通過 |
| `rejected` | `rejected` | 人工退回 (`source=manual`)，帶 `reject_reason` |

---

## File Structure

- **Create** `supabase/migrations/00047_ig_manual_verification.sql` — 擴充表 + enum + index
- **Create** `app/api/instagram/verify/sent/route.ts` — created→sent、凍結過期
- **Create** `app/api/instagram/verify/escalate/route.ts` — sent→pending、落人工
- **Modify** `app/api/instagram/verify/start/route.ts` — 寫 status、重申請清理、重驗撤銷
- **Modify** `app/api/instagram/verify/status/route.ts` — 僅掃 sent、成功寫 source=auto
- **Modify** `app/api/instagram/verify/pending/route.ts` — 回未結案筆 + status
- **Create** `lib/hooks/use-ig-verification.ts` — 共用驗證狀態機 hook
- **Create** `components/seller/ig-verification-card.tsx` — 共用 IG 驗證卡片 UI
- **Modify** `app/(seller)/dashboard/profile/page.tsx` — 改用 hook + 卡片
- **Modify** `app/(user)/become-seller/page.tsx` — 改用 hook + 卡片
- **Modify** `server/db/types.ts:29` — `NotificationType` 加 IG 兩型
- **Modify** `components/shared/notification-content.tsx` — 加 IG 兩型文案
- **Modify** `server/routers/admin.ts` — 新增四支 IG procedure
- **Rename/Modify** `app/(admin)/admin/threads-verification/` → `app/(admin)/admin/social-verification/page.tsx` — 合併分頁
- **Modify** `components/layout/sidebar.tsx:34` — 導覽連結改名/改路由

---

## Task 1: Migration — 擴充 `ig_verification_codes`

**Files:**
- Create: `supabase/migrations/00047_ig_manual_verification.sql`

- [ ] **Step 1: 寫 migration**

```sql
-- IG 驗證改混合模式：自動為主、人工為輔。擴充既有 ig_verification_codes 承載審核狀態。
ALTER TABLE ig_verification_codes
  ADD COLUMN IF NOT EXISTS status        text NOT NULL DEFAULT 'created', -- created|sent|pending|approved|rejected
  ADD COLUMN IF NOT EXISTS source        text,                            -- auto|manual（離開 sent 時填）
  ADD COLUMN IF NOT EXISTS reject_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by   uuid;

-- 既有資料（若有）：已驗證的補成 approved/auto
UPDATE ig_verification_codes
  SET status = 'approved', source = 'auto'
  WHERE verified_at IS NOT NULL AND status = 'created';

CREATE INDEX IF NOT EXISTS idx_ig_verif_status ON ig_verification_codes (status, created_at);
CREATE INDEX IF NOT EXISTS idx_ig_verif_seller ON ig_verification_codes (seller_id);

-- 站內通知類型
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ig_verification_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ig_verification_rejected';
```

- [ ] **Step 2: 確認 migration 內容無誤**

Run: `cat supabase/migrations/00047_ig_manual_verification.sql`
Expected: 上述內容；編號 00047 為目前最大（00046）之後。

- [ ] **Step 3: 用 Supabase MCP 套用到實際資料庫**

用 MCP `mcp__supabase__apply_migration`，name=`ig_manual_verification`，query=上述 SQL。
> 註：`ALTER TYPE ... ADD VALUE` 在部分 Postgres 不能與其他語句同一交易執行。若 MCP 回報交易錯誤，將兩個 `ALTER TYPE` 拆成獨立呼叫各自套用。

- [ ] **Step 4: 驗證欄位已建立**

用 MCP `mcp__supabase__execute_sql`：
```sql
select column_name from information_schema.columns where table_name='ig_verification_codes' order by ordinal_position;
```
Expected: 含 status / source / reject_reason / reviewed_at / reviewed_by。

---

## Task 2: 後端 API — start / sent / escalate / status / pending

**Files:**
- Modify: `app/api/instagram/verify/start/route.ts`
- Create: `app/api/instagram/verify/sent/route.ts`
- Create: `app/api/instagram/verify/escalate/route.ts`
- Modify: `app/api/instagram/verify/status/route.ts`
- Modify: `app/api/instagram/verify/pending/route.ts`

- [ ] **Step 1: 改 `start/route.ts`**

把第 43-67 行（清舊碼 + 產碼插入）替換為下列邏輯：清掉**非 approved** 的舊筆、若已驗證則先撤銷、插入 `status:'created'`。

```ts
  // 清除此 seller 既有未結案的碼（非 approved）
  await db
    .from('ig_verification_codes')
    .delete()
    .eq('seller_id', user.id)
    .neq('status', 'approved')

  // 重驗撤銷：若目前已驗證，產新碼即先撤銷已驗證狀態，審過才恢復
  await db
    .from('sellers')
    .update({ is_social_verified: false })
    .eq('id', user.id)
    .eq('is_social_verified', true)

  // 用 CSPRNG 產 4 位數碼
  const code = String(randomInt(1000, 10000))
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  const { data, error } = await db
    .from('ig_verification_codes')
    .insert({
      seller_id: user.id,
      ig_username: igUsername,
      code,
      expires_at: expiresAt.toISOString(),
      status: 'created',
    })
    .select('id, code, expires_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create code' }, { status: 500 })
  }

  return NextResponse.json(data)
```
> 註：Rate limit（第 24-41 行）維持不動。

- [ ] **Step 2: 建 `sent/route.ts`（created→sent，凍結過期）**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getDb } from '@/server/db/client'

// 使用者按「我已傳送」：凍結過期、進入自動掃階段
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const db = getDb()
  const { data, error } = await db
    .from('ig_verification_codes')
    .update({ status: 'sent', expires_at: null })
    .eq('id', id)
    .eq('seller_id', user.id)
    .eq('status', 'created')
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found or already sent' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: 建 `escalate/route.ts`（sent→pending，落人工）**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getDb } from '@/server/db/client'

// 自動掃 5 次未中：落到管理員人工待審
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const db = getDb()
  const { data, error } = await db
    .from('ig_verification_codes')
    .update({ status: 'pending' })
    .eq('id', id)
    .eq('seller_id', user.id)
    .eq('status', 'sent')
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  if (!data) return NextResponse.json({ escalated: false })
  return NextResponse.json({ escalated: true })
}
```

- [ ] **Step 4: 改 `status/route.ts`**

把 select 補上 `status`；改成只對 `status='sent'` 掃；移除 `expired` 判斷（sent 已無期限）；命中時寫 `status:'approved', source:'auto'`。把第 18-57 行替換為：

```ts
  const db = getDb()
  const { data: codeRow } = await db
    .from('ig_verification_codes')
    .select('id, seller_id, ig_username, code, status, verified_at')
    .eq('id', id)
    .eq('seller_id', user.id)
    .single()

  if (!codeRow) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (codeRow.status === 'approved') {
    return NextResponse.json({ verified: true, ig_handle: codeRow.ig_username })
  }

  // 只有「已按我已傳送」的 sent 階段才掃收件匣
  if (codeRow.status !== 'sent') {
    return NextResponse.json({ verified: false })
  }

  const result = await checkIgInbox(codeRow.ig_username, codeRow.code)

  if (result.found) {
    await Promise.all([
      db.from('sellers').update({
        ig_handle: codeRow.ig_username,
        ig_user_id: result.senderIgsid ?? null,
        ig_connected_at: new Date().toISOString(),
        is_social_verified: true,
      }).eq('id', user.id),

      db.from('ig_verification_codes').update({
        status: 'approved',
        source: 'auto',
        verified_at: new Date().toISOString(),
      }).eq('id', codeRow.id),
    ])

    return NextResponse.json({ verified: true, ig_handle: codeRow.ig_username })
  }

  return NextResponse.json({ verified: false })
```
> `checkIgInbox`（第 60 行起）維持不動。

- [ ] **Step 5: 改 `pending/route.ts`（回未結案 + status）**

把整個 GET 主體替換為：回傳此 seller 最新一筆未結案記錄。

```ts
  const db = getDb()
  const { data } = await db
    .from('ig_verification_codes')
    .select('id, code, expires_at, status, reject_reason')
    .eq('seller_id', user.id)
    .in('status', ['created', 'sent', 'pending', 'rejected'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // created 且已過期視為無效
  if (data && data.status === 'created' && data.expires_at && new Date(data.expires_at) < new Date()) {
    return NextResponse.json(null)
  }

  return NextResponse.json(data ?? null)
```

- [ ] **Step 6: 編譯檢查**

Run: `npm run build`
Expected: 編譯成功，無型別錯誤。

---

## Task 3: 通知型別與文案

**Files:**
- Modify: `server/db/types.ts:29`
- Modify: `components/shared/notification-content.tsx`

- [ ] **Step 1: `NotificationType` 補齊（含 threads 既漏的兩型 + IG 兩型）**

把 `server/db/types.ts` 第 29-37 行的 `NotificationType` 改為：

```ts
export type NotificationType =
  | 'review_received'
  | 'listing_removed_by_admin'
  | 'listing_republish_approved'
  | 'connection_removed_by_admin'
  | 'connection_republish_approved'
  | 'product_removed'
  | 'account_action_taken'
  | 'new_listing_for_wish'
  | 'threads_verification_approved'
  | 'threads_verification_rejected'
  | 'ig_verification_approved'
  | 'ig_verification_rejected'
```

- [ ] **Step 2: `notification-content.tsx` 加 IG 文案**

在第 32 行附近 `threadsUsername` 後加 `igUsername`：

```ts
  const igUsername = typeof p.ig_username === 'string' ? p.ig_username : null
```

在 `threads_verification_rejected` case（第 99 行）之後、`new_listing_for_wish` 之前插入：

```ts
    case 'ig_verification_approved':
      return {
        title: 'Instagram 帳號驗證已通過',
        body: igUsername
          ? `你的 Instagram 帳號「@${igUsername}」已通過驗證，賣家頁將顯示驗證標章。`
          : '你的 Instagram 帳號已通過驗證，賣家頁將顯示驗證標章。',
      }
    case 'ig_verification_rejected':
      return {
        title: 'Instagram 帳號驗證未通過',
        body: (
          <>
            {reason ? `因「${reason}」，` : ''}你的 Instagram 帳號{igUsername ? `「@${igUsername}」` : ''}驗證未通過，請確認後重新申請，如有疑問請來信 <MailLink />。
          </>
        ),
      }
```

- [ ] **Step 3: 編譯檢查**

Run: `npm run build`
Expected: 成功。

---

## Task 4: admin router — 四支 IG procedure

**Files:**
- Modify: `server/routers/admin.ts`（在 `rejectThreadsVerification` 之後、router 結尾 `})` 之前插入）

- [ ] **Step 1: 新增 list / history / approve / reject**

在 `server/routers/admin.ts` 第 1014 行（`rejectThreadsVerification` 結束）之後插入下列四支，命名與 Threads 對齊：

```ts
  listIgVerifications: adminProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.db
      .from('ig_verification_codes')
      .select('id, seller_id, ig_username, code, created_at, sellers(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map((r: {
      id: string; seller_id: string; ig_username: string; code: string; created_at: string
      sellers: { name: string } | { name: string }[] | null
    }) => ({
      id: r.id,
      seller_id: r.seller_id,
      ig_username: r.ig_username,
      code: r.code,
      created_at: r.created_at,
      seller_name: Array.isArray(r.sellers) ? r.sellers[0]?.name ?? '' : r.sellers?.name ?? '',
    }))
  }),

  listIgVerificationHistory: adminProcedure
    .input(z.object({ from: z.string().optional(), to: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      let q = ctx.db
        .from('ig_verification_codes')
        .select('id, seller_id, ig_username, status, source, reject_reason, reviewed_at, verified_at, created_at, sellers(name)')
        .in('status', ['approved', 'rejected'])
      if (input.from) q = q.gte('reviewed_at', new Date(`${input.from}T00:00:00+08:00`).toISOString())
      if (input.to) q = q.lte('reviewed_at', new Date(`${input.to}T23:59:59.999+08:00`).toISOString())
      const { data, error } = await q.order('created_at', { ascending: false }).limit(200)
      if (error) throw error
      return (data ?? []).map((r: {
        id: string; seller_id: string; ig_username: string; status: string; source: string | null
        reject_reason: string | null; reviewed_at: string | null; verified_at: string | null; created_at: string
        sellers: { name: string } | { name: string }[] | null
      }) => ({
        id: r.id,
        seller_id: r.seller_id,
        ig_username: r.ig_username,
        status: r.status,
        source: r.source,
        reject_reason: r.reject_reason,
        // 自動通過無 reviewed_at，用 verified_at 當審核時間顯示
        reviewed_at: r.reviewed_at ?? r.verified_at,
        created_at: r.created_at,
        seller_name: Array.isArray(r.sellers) ? r.sellers[0]?.name ?? '' : r.sellers?.name ?? '',
      }))
    }),

  approveIgVerification: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: req } = await ctx.db
        .from('ig_verification_codes')
        .select('id, seller_id, ig_username, status')
        .eq('id', input.id)
        .maybeSingle()
      if (!req) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到此申請' })
      if (req.status !== 'pending') throw new TRPCError({ code: 'BAD_REQUEST', message: '此申請已處理過' })

      await ctx.db.from('sellers').update({
        ig_handle: req.ig_username,
        ig_connected_at: new Date().toISOString(),
        is_social_verified: true,
      }).eq('id', req.seller_id)

      await ctx.db.from('ig_verification_codes').update({
        status: 'approved',
        source: 'manual',
        reviewed_at: new Date().toISOString(),
        reviewed_by: ctx.user.id,
      }).eq('id', req.id)

      await ctx.db.from('notifications').insert({
        recipient_id: req.seller_id,
        type: 'ig_verification_approved',
        payload: { ig_username: req.ig_username },
      })
      return { success: true }
    }),

  rejectIgVerification: adminProcedure
    .input(z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const { data: req } = await ctx.db
        .from('ig_verification_codes')
        .select('id, seller_id, ig_username, status')
        .eq('id', input.id)
        .maybeSingle()
      if (!req) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到此申請' })
      if (req.status !== 'pending') throw new TRPCError({ code: 'BAD_REQUEST', message: '此申請已處理過' })

      await ctx.db.from('ig_verification_codes').update({
        status: 'rejected',
        source: 'manual',
        reject_reason: input.reason ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: ctx.user.id,
      }).eq('id', req.id)

      await ctx.db.from('notifications').insert({
        recipient_id: req.seller_id,
        type: 'ig_verification_rejected',
        payload: { ig_username: req.ig_username, reason: input.reason ?? null },
      })
      return { success: true }
    }),
```
> 確認檔案頂部已 import `z` 與 `TRPCError`（Threads procedure 既已使用，應已存在）。

- [ ] **Step 2: 編譯檢查**

Run: `npm run build`
Expected: 成功；tRPC client 型別出現 `admin.listIgVerifications` 等。

---

## Task 5: 共用 hook `useIgVerification`

**Files:**
- Create: `lib/hooks/use-ig-verification.ts`

抽離 profile 頁第 43-198、200-215、256-265、279-314 行的 IG 驗證邏輯。`failed` 移除，新增 `reviewing`/`rejected`，按「我已傳送」改呼叫 `sent` 端點、輪詢滿 5 次呼叫 `escalate`。

- [ ] **Step 1: 寫 hook**

```ts
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

export type IgVerifyStep =
  | { step: 'idle' }
  | { step: 'entering_username' }
  | { step: 'loading_code' }
  | { step: 'waiting_send'; id: string; code: string; expiresAt: string }
  | { step: 'polling'; id: string; code: string }
  | { step: 'reviewing'; id: string }
  | { step: 'rejected'; reason: string | null }
  | { step: 'success' }

export function useIgVerification(onVerified?: () => void) {
  const [state, setState] = useState<IgVerifyStep>({ step: 'idle' })
  const [usernameInput, setUsernameInput] = useState('')
  const [inputError, setInputError] = useState('')
  const [countdown, setCountdown] = useState('')
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
  }, [])

  // 產碼
  const start = useCallback(async () => {
    const username = usernameInput.trim().toLowerCase()
    if (!username) { setInputError('請輸入Instagram帳號'); return }
    setInputError('')
    setState({ step: 'loading_code' })
    try {
      const res = await fetch('/api/instagram/verify/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ig_username: username }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setState({ step: 'waiting_send', id: data.id, code: data.code, expiresAt: data.expires_at })
    } catch {
      toast.error('產生驗證碼失敗，請重試')
      setState({ step: 'entering_username' })
    }
  }, [usernameInput])

  // 按「我已傳送」：凍結過期，開始自動掃
  const confirmSent = useCallback(async (id: string, code: string) => {
    stopPolling()
    try {
      await fetch('/api/instagram/verify/sent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    } catch { /* 忽略，仍進輪詢 */ }
    let attempts = 0
    setState({ step: 'polling', id, code })
    pollingRef.current = setInterval(async () => {
      if (!pollingRef.current) return
      try {
        const res = await fetch(`/api/instagram/verify/status?id=${id}`)
        const data = await res.json()
        if (!pollingRef.current) return
        if (data.verified) {
          stopPolling()
          setState({ step: 'success' })
          onVerified?.()
        } else {
          attempts++
          if (attempts >= 5) {
            stopPolling()
            await fetch('/api/instagram/verify/escalate', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id }),
            })
            setState({ step: 'reviewing', id })
          }
        }
      } catch { /* 下次再試 */ }
    }, 10000)
  }, [onVerified, stopPolling])

  const cancel = useCallback(async () => {
    stopPolling()
    if (state.step === 'polling' || state.step === 'waiting_send' || state.step === 'reviewing') {
      const id = 'id' in state ? state.id : undefined
      if (id) {
        void fetch('/api/instagram/verify/cancel', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
      }
    }
    setState({ step: 'idle' }); setUsernameInput(''); setInputError('')
  }, [state, stopPolling])

  // 還原進行中的驗證
  useEffect(() => {
    fetch('/api/instagram/verify/pending')
      .then(r => r.json())
      .then((d: { id: string; code: string; expires_at: string | null; status: string; reject_reason: string | null } | null) => {
        if (!d) return
        if (d.status === 'created' && d.expires_at) setState({ step: 'waiting_send', id: d.id, code: d.code, expiresAt: d.expires_at })
        else if (d.status === 'sent') confirmSent(d.id, d.code)
        else if (d.status === 'pending') setState({ step: 'reviewing', id: d.id })
        else if (d.status === 'rejected') setState({ step: 'rejected', reason: d.reject_reason })
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => stopPolling(), [stopPolling])

  // 倒數：只在 waiting_send 跑
  const expiresAt = state.step === 'waiting_send' ? state.expiresAt : null
  useEffect(() => {
    if (!expiresAt) { setCountdown(''); return }
    const ms = new Date(expiresAt).getTime()
    const tick = () => {
      const remaining = Math.max(0, ms - Date.now())
      const m = Math.floor(remaining / 60000)
      const s = Math.floor((remaining % 60000) / 1000)
      setCountdown(`${m}:${String(s).padStart(2, '0')}`)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [expiresAt])

  // waiting_send 倒數歸零 → 作廢
  useEffect(() => {
    if (countdown !== '0:00') return
    if (state.step !== 'waiting_send') return
    void fetch('/api/instagram/verify/cancel', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: state.id }),
    })
    toast.error('驗證碼已過期，請重新取得')
    setState({ step: 'idle' }); setUsernameInput(''); setInputError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, state.step])

  return { state, setState, usernameInput, setUsernameInput, inputError, setInputError, countdown, start, confirmSent, cancel }
}
```

- [ ] **Step 2: 編譯檢查**

Run: `npm run build`
Expected: 成功（此時尚未被頁面使用，僅確認 hook 本身型別正確）。

---

## Task 6: 共用卡片元件 `IgVerificationCard`

**Files:**
- Create: `components/seller/ig-verification-card.tsx`

把 profile 頁 IG 各 step 的 JSX（第 690-810 行區段：entering_username / loading_code / waiting_send / polling / success，**移除 failed**，新增 reviewing / rejected）搬進此元件。reviewing / rejected 的樣式參照 profile 頁 Threads 對應段（reviewing 見第 631 行附近「審核中」卡片；rejected 參照 Threads rejected 區塊）。

- [ ] **Step 1: 寫元件骨架（接 hook 回傳值）**

```tsx
'use client'

import { Loader2 } from 'lucide-react'
import { useIgVerification } from '@/lib/hooks/use-ig-verification'

type Props = {
  vm: ReturnType<typeof useIgVerification>
  adminHandle: string
}

export function IgVerificationCard({ vm, adminHandle }: Props) {
  const { state, usernameInput, setUsernameInput, inputError, countdown, start, confirmSent, cancel } = vm

  return (
    <div className="flex flex-col gap-6">
      {/* entering_username / loading_code：沿用 profile 既有輸入框 + 取得驗證碼按鈕 JSX */}

      {state.step === 'waiting_send' && (
        <div className="flex flex-col gap-6">
          <div className="text-center space-y-1">
            <p className="font-semibold text-[15px] text-text-strong">傳送驗證碼</p>
            <p className="text-[13px] text-text-muted leading-relaxed">
              用 Instagram 私訊以下數字給{' '}
              <a href={`https://www.instagram.com/${adminHandle}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-text-strong hover:underline">@{adminHandle}</a>
            </p>
            <p className="text-[13px] text-text-muted leading-relaxed">傳送後請點擊『<span className="text-text-strong">我已傳送</span>』按鈕</p>
          </div>
          <div className="flex justify-center gap-2">
            {state.code.toString().split('').map((d, i) => (
              <div key={i} className="flex items-center justify-center rounded-xl border-2 border-border-soft bg-surface-muted text-[22px] font-mono font-bold text-text-strong shadow-sm" style={{ width: 40, height: 52 }}>{d}</div>
            ))}
          </div>
          <span className="text-[12px] font-mono text-text-faint tabular-nums text-center">剩餘時間 {countdown}</span>
          <div className="flex flex-col gap-2">
            <button onClick={() => confirmSent(state.id, state.code)} className="h-11 w-full rounded-xl border border-brand-500 bg-surface-card text-brand-700 text-[14px] font-semibold hover:bg-brand-500 hover:text-cta-foreground active:translate-y-px transition-[background,color,transform]">我已傳送</button>
            <button onClick={cancel} className="h-10 w-full rounded-xl text-[13px] text-text-muted hover:text-text-strong transition-colors">取消</button>
          </div>
        </div>
      )}

      {state.step === 'polling' && (
        <div className="flex flex-col gap-6">
          <div className="flex justify-center gap-2">
            {state.code.toString().split('').map((d, i) => (
              <div key={i} className="flex items-center justify-center rounded-xl border-2 border-border-soft bg-surface-muted text-[22px] font-mono font-bold text-text-strong shadow-sm" style={{ width: 40, height: 52 }}>{d}</div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-1.5 text-[12px] text-text-faint">
            <Loader2 className="h-3 w-3 animate-spin" />確認中⋯
          </div>
          <button onClick={cancel} className="h-10 w-full rounded-xl text-[13px] text-text-muted hover:text-text-strong transition-colors">取消</button>
        </div>
      )}

      {state.step === 'reviewing' && (
        <div className="text-center space-y-2">
          <p className="font-semibold text-[15px] text-text-strong">審核中</p>
          <p className="text-[13px] text-text-muted leading-relaxed">我們已收到你的驗證,管理員審核通過後會以通知告知你。你可以先離開這個頁面。</p>
        </div>
      )}

      {state.step === 'rejected' && (
        <div className="text-center space-y-3">
          <p className="font-semibold text-[15px] text-text-strong">驗證未通過</p>
          {state.reason && <p className="text-[13px] text-text-muted leading-relaxed">原因:{state.reason}</p>}
          <button onClick={() => vm.setState({ step: 'entering_username' })} className="h-10 px-4 rounded-xl border border-brand-500 text-brand-700 text-[13px] font-semibold">重新申請</button>
        </div>
      )}

      {state.step === 'success' && (
        <div className="text-center space-y-2">
          <p className="font-semibold text-[15px] text-text-strong">驗證成功</p>
        </div>
      )}
    </div>
  )
}
```
> entering_username / loading_code 區塊請直接從 profile 頁第 640-720 行對應 JSX 搬入（含輸入框、`inputError` 顯示、「取得驗證碼」按鈕呼叫 `start`）。保持 className 一致。

- [ ] **Step 2: 編譯檢查**

Run: `npm run build`
Expected: 成功。

---

## Task 7: 接入 profile 與 become-seller

**Files:**
- Modify: `app/(seller)/dashboard/profile/page.tsx`
- Modify: `app/(user)/become-seller/page.tsx`

- [ ] **Step 1: profile 頁改用 hook + 卡片**

- 移除第 43-58 行的 IG 狀態機型別/state、第 57 行 `pollingRef`、第 132-215 行的 `handleIgVerifyStart`/`startPolling`/`beginPolling`/`cancelIgVerify`、第 256-265 行 IG pending useEffect、第 283-314 行 IG 倒數 useEffect。
- 在元件頂部改為：
```ts
const igVm = useIgVerification(() => void refetchSeller())
const adminHandle = process.env.NEXT_PUBLIC_INSTAGRAM_ADMIN_HANDLE ?? ''
```
- 把第 690-810 行整個 IG 區塊替換為 `<IgVerificationCard vm={igVm} adminHandle={adminHandle} />`。
- import：`import { useIgVerification } from '@/lib/hooks/use-ig-verification'` 與 `import { IgVerificationCard } from '@/components/seller/ig-verification-card'`。
- Threads 區塊維持不動。

- [ ] **Step 2: become-seller 頁比照替換**

對 `app/(user)/become-seller/page.tsx` 做同樣替換：移除第 123-137、240-302、346-375 行的 IG 狀態機/輪詢/倒數邏輯，改用 `useIgVerification`，把第 634-810 行 IG UI 區塊換成 `<IgVerificationCard vm={igVm} adminHandle={adminHandle} />`。Threads 區塊不動。
> become-seller 若有「驗證成功後才能送出申請」的 gating，改用 `igVm.state.step === 'success'` 判斷。

- [ ] **Step 3: 編譯與 lint**

Run: `npm run build && npm run lint`
Expected: 成功，無 `failed` step 殘留引用。

- [ ] **Step 4: 手動驗證（dev server）**

Run: `npm run dev`，登入賣家 → profile：
1. 輸入 IG 帳號 → 取得驗證碼 → 看到碼 + 倒數。
2. 不傳、按「我已傳送」→ 進「確認中」，10 秒輪詢；50 秒後（掃不到）轉「審核中」。
3. 重整頁面 → 仍停在「審核中」（pending 還原）。
Expected: 行為符合；DB 該筆 `status` 依序 created→sent→pending。

---

## Task 8: 後台合併為「社群驗證」頁

**Files:**
- Create: `app/(admin)/admin/social-verification/page.tsx`
- Delete: `app/(admin)/admin/threads-verification/page.tsx`
- Modify: `components/layout/sidebar.tsx:34`

- [ ] **Step 1: 建合併頁**

以現有 `threads-verification/page.tsx` 為基礎，最外層加一組 Tabs 切 `instagram` / `threads`，各自內含原本的「待審核 / 審核紀錄」結構：

- Instagram 分頁：資料來源改 `trpc.admin.listIgVerifications` / `listIgVerificationHistory`，mutation 改 `approveIgVerification` / `rejectIgVerification`；欄位 `threads_username`→`ig_username`、連結 `https://www.instagram.com/{ig_username}`；「審核紀錄」表頭多一欄「來源」，值依 `req.source`：`auto`→`🤖 自動`、`manual`→`👤 人工`。
- Threads 分頁：沿用原本的 query/mutation 與表格，原封不動搬入。
- 標題改為「社群驗證」。

> 兩個分頁的待審/紀錄表格結構高度相同，可抽一個內部 `<VerificationTables>` 子元件以平台/帳號欄位參數化，避免複製貼上（DRY）。Instagram 紀錄表多「來源」欄。

- [ ] **Step 2: 刪除舊頁**

Run: `rm app/\(admin\)/admin/threads-verification/page.tsx`
（若 threads-verification 目錄因此變空，一併移除目錄。）

- [ ] **Step 3: 更新側邊導覽**

`components/layout/sidebar.tsx` 第 34 行：
```ts
  { href: '/admin/social-verification', label: '社群驗證', icon: UserCog },
```

- [ ] **Step 4: 全庫搜尋殘留連結**

Run: `grep -rn "threads-verification" app components`
Expected: 無結果（buyer 頁先前的命中若與此功能無關則略過，需逐一確認非導向此後台路由）。

- [ ] **Step 5: 編譯 + 手動驗證**

Run: `npm run build`，dev server 登入 admin → `/admin/social-verification`：
1. Instagram 分頁「待審核」看得到 Task 7 落人工的那筆（含 IG 帳號、驗證碼）。
2. 按「通過」→ toast 成功，該筆移入「審核紀錄」，來源顯示「👤 人工」；賣家收到 `ig_verification_approved` 通知；seller `is_social_verified=true`。
3. 另測「退回」+原因 → 賣家端 IG 卡片顯示「驗證未通過」+原因 + 可重新申請。
4. 自動通過一筆（真實 DM 對碼），確認「審核紀錄」該筆來源顯示「🤖 自動」。

---

## Task 9: 文件與收尾

**Files:**
- Modify: `docs/platform-overview.md`

- [ ] **Step 1: 更新平台總覽**

在 `docs/platform-overview.md` 的驗證/賣家相關段落，更新 IG 驗證描述為「自動為主、人工為輔」混合流程，並說明後台「社群驗證」合併頁。

- [ ] **Step 2: 最終全量檢查**

Run: `npm run build && npm run lint`
Expected: 皆通過。

---

## Self-Review 對照（spec 覆蓋）

- 過期規則（created 15 分、sent 凍結）→ Task 2 Step 1/2、Task 5 倒數邏輯 ✓
- 「我已傳送」持久化 → Task 2 Step 2（sent 端點）、Task 5 confirmSent ✓
- 自動掃 5 次落人工、停止輪詢 → Task 2 Step 3、Task 5 attempts>=5 → escalate ✓
- 後台全記 + 標來源 → Task 1（source 欄）、Task 4 history、Task 8 來源欄 ✓
- 重申請清非 approved、重驗撤銷 → Task 2 Step 1 ✓
- 抽共用元件、兩頁共用 → Task 5/6/7 ✓
- 後台合併頁 + 路由/導覽 → Task 8 ✓
- 通知兩型 → Task 1 enum、Task 3 文案、Task 4 發送 ✓
```
