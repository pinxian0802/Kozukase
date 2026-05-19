# Sentry 整合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 整合官方 `@sentry/nextjs` SDK，讓 production 錯誤能被即時回報並可重現（含效能監控與 Session Replay）。

**Architecture:** 使用 Sentry 官方 wizard 產生 Next.js 16 的標準設定檔（client / server / edge init + instrumentation + withSentryConfig），再手動調整取樣率、隱私設定，並在 tRPC route 加上錯誤過濾，只送非預期錯誤。

**Tech Stack:** Next.js 16.2.3 (App Router)、tRPC v11、`@sentry/nextjs`、Vercel、Sentry SaaS。

> **重要：依使用者要求，本次實作全程不執行 git commit。** 每個 Task 結尾以「手動驗證」取代 commit。實作者完成後不要 commit，交由使用者自行決定。

---

## 前置需求（實作者開始前確認）

- 使用者已有 Sentry 帳號與專案，手邊有 **DSN**、**org slug**、**project slug**
- 使用者 Sentry 帳號可產生 **Auth Token**（source map 上傳用）
- 若實作者沒有這些值，先停下來向使用者索取，不要猜測或留 placeholder

---

## File Structure

| 檔案 | 責任 | 動作 |
|---|---|---|
| `instrumentation-client.ts` | 瀏覽器端 Sentry init + Session Replay + 取樣率 | wizard 建立，手動調整 |
| `sentry.server.config.ts` | Node server 端 init + 取樣率 | wizard 建立，手動調整 |
| `sentry.edge.config.ts` | Edge runtime init | wizard 建立 |
| `instrumentation.ts` | 註冊 server/edge + `onRequestError` | wizard 建立 |
| `app/global-error.tsx` | 全域 React 錯誤邊界 | wizard 建立（若無則手動建立） |
| `next.config.ts` | `withSentryConfig` 包裝 | wizard 修改，手動驗證 |
| `app/api/trpc/[trpc]/route.ts` | tRPC `onError` 過濾並送非預期錯誤 | 手動修改 |
| `.env.local` | `NEXT_PUBLIC_SENTRY_DSN`、`SENTRY_AUTH_TOKEN` | wizard / 手動 |
| `.env.example` | 記錄需要的變數（不含實際值） | 手動 |
| `.gitignore` | 確認 `.env*.local`、`.sentryclirc` 已被忽略 | 手動驗證 |

---

## Task 1: 安裝並執行 Sentry wizard

**Files:**
- Modify: `package.json`（新增 `@sentry/nextjs` 依賴）
- Create: `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`, `app/global-error.tsx`
- Modify: `next.config.ts`, `.env.local`

- [ ] **Step 1: 執行 Sentry wizard**

wizard 為互動式，需使用者參與（登入、選 org/project）。實作者應請使用者在終端機自行執行：

```bash
npx @sentry/wizard@latest -i nextjs
```

wizard 過程選項建議：
- 是否用 Sentry 帳號登入：是
- 選擇既有 project：選使用者已建立的那個
- 啟用 Session Replay：**是**
- 啟用 Tracing / Performance：**是**
- 建立範例頁面（example page）：**是**（用於驗證，驗證後於 Task 6 移除）
- 自動上傳 source maps：**是**

- [ ] **Step 2: 驗證安裝結果**

確認以下檔案已存在：

Run: `ls instrumentation-client.ts sentry.server.config.ts sentry.edge.config.ts instrumentation.ts app/global-error.tsx`
Expected: 五個檔案都存在（路徑可能在 `src/` 下，視專案結構而定 — 本專案無 `src/`，應在 root）

確認 `package.json` 有 `@sentry/nextjs`：

Run: `npm ls @sentry/nextjs`
Expected: 顯示已安裝版本（無 error）

- [ ] **Step 3: 驗證 next.config.ts 被正確包裝**

讀 `next.config.ts`，確認：
- 仍 `import type { NextConfig } from "next"`
- 結尾改為 `export default withSentryConfig(nextConfig, { ... })`
- 原本的 `images.remotePatterns`、`allowedDevOrigins` 設定**完整保留**（wizard 只包裝不應刪除既有設定）

若 wizard 破壞了既有 config，手動合併還原 `images` / `allowedDevOrigins` 設定。

- [ ] **Step 4: 手動驗證（取代 commit）**

Run: `npm run build`
Expected: build 成功，無 TypeScript / 設定錯誤。若 build 因缺 `SENTRY_AUTH_TOKEN` 只有 warning（非 error）可接受。

⚠️ 本次不 commit。

---

## Task 2: 調整取樣率與隱私設定

**Files:**
- Modify: `instrumentation-client.ts`
- Modify: `sentry.server.config.ts`

- [ ] **Step 1: 調整 client 端取樣率與 Replay**

開啟 `instrumentation-client.ts`，將 `Sentry.init({...})` 內的設定調整為以下值（保留 wizard 產生的 `dsn`、`integrations` 等其他欄位）：

```ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 效能追蹤：10% 請求，避免吃光額度
  tracesSampleRate: 0.1,

  // 一般 session 不主動錄製
  replaysSessionSampleRate: 0,
  // 出錯才回溯錄製，100%
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      // 隱私：遮蔽所有文字與媒體，避免錄到個資/密碼
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
})
```

注意：若 wizard 產生的 `integrations` 已包含 `replayIntegration()`，只需確保 `maskAllText: true` 與 `blockAllMedia: true` 有設定（這兩個是 Sentry 預設值，明確寫出以防未來預設變動）。不要重複新增 `replayIntegration`。

- [ ] **Step 2: 調整 server 端取樣率**

開啟 `sentry.server.config.ts`，確認/設定：

```ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
})
```

（server 端無 Session Replay，只需 traces 取樣率。保留 wizard 其他設定。）

- [ ] **Step 3: 手動驗證（取代 commit）**

Run: `npm run build`
Expected: build 成功，無型別錯誤。

⚠️ 本次不 commit。

---

## Task 3: tRPC 錯誤過濾

**Files:**
- Modify: `app/api/trpc/[trpc]/route.ts`

**背景：** 現有程式碼用 `TRPCError` 做正常流程控制（`UNAUTHORIZED`「請先登入」、`FORBIDDEN`「需要賣家身份/帳號已被停權/需要管理員權限」）。這些是預期行為，不可送 Sentry，否則告警會被雜訊淹沒。只送非預期錯誤。

- [ ] **Step 1: 改寫 route.ts 加上 onError 過濾**

將 `app/api/trpc/[trpc]/route.ts` 完整改為：

```ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import * as Sentry from '@sentry/nextjs'
import { appRouter } from '@/server/root'
import { createTRPCContext } from '@/server/trpc'
import type { TRPCError } from '@trpc/server'

// 預期內的 tRPC 錯誤 code（流程控制，不送 Sentry）
const EXPECTED_TRPC_CODES = new Set([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'BAD_REQUEST',
  'CONFLICT',
  'TOO_MANY_REQUESTS',
  'PARSE_ERROR',
])

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: createTRPCContext,
    onError({ error, path }) {
      const code = (error as TRPCError).code
      if (code && EXPECTED_TRPC_CODES.has(code)) {
        return
      }
      Sentry.captureException(error, {
        tags: { trpcPath: path ?? 'unknown' },
      })
    },
  })

export { handler as GET, handler as POST }
```

理由：白名單列出已知的「使用者錯誤 / 流程控制」code，其餘（特別是 `INTERNAL_SERVER_ERROR` 及未列出的）都視為非預期並送 Sentry。

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無新增型別錯誤（若專案原本就有無關錯誤，確認沒有來自 route.ts 的新錯誤）。

- [ ] **Step 3: 手動驗證（取代 commit）**

Run: `npm run build`
Expected: build 成功。

⚠️ 本次不 commit。

---

## Task 4: 環境變數文件化與 gitignore 驗證

**Files:**
- Create/Modify: `.env.example`
- Verify: `.gitignore`
- Verify: `.env.local`

- [ ] **Step 1: 確認 .gitignore 忽略敏感檔**

讀 `.gitignore`，確認包含（Next.js 預設應已有 `.env*.local`）：
- `.env*.local`
- `.sentryclirc`（wizard 可能產生，含 auth token）

若缺 `.sentryclirc`，手動加入 `.gitignore`。

- [ ] **Step 2: 確認 .env.local 內容**

讀 `.env.local`，確認有：
- `NEXT_PUBLIC_SENTRY_DSN=<使用者的 DSN>`
- `SENTRY_AUTH_TOKEN=<使用者的 auth token>`（wizard 可能放這或 `.sentryclirc`）

確認這些值非空、非 placeholder。若為空，向使用者索取。

- [ ] **Step 3: 更新 .env.example**

在 `.env.example`（若不存在則建立）加入以下兩行（**只記錄變數名，不含實際值**）：

```
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
```

若 `.env.example` 不存在且專案慣例無此檔，可跳過此步並改在計畫筆記註明 Vercel 需設定的變數。

- [ ] **Step 4: 確認 git 不會追蹤敏感值**

Run: `git status --porcelain`
Expected: 輸出中**不應**出現 `.env.local` 或 `.sentryclirc`（若出現代表 gitignore 沒生效，需修正）。

⚠️ 本次不 commit。

---

## Task 5: Vercel 環境變數設定（使用者操作）

**Files:** 無（外部平台設定）

- [ ] **Step 1: 指引使用者在 Vercel 設定環境變數**

向使用者說明：需在 Vercel 專案 → Settings → Environment Variables 加入：
- `NEXT_PUBLIC_SENTRY_DSN`：與本機相同的 DSN（Production + Preview + Development 都勾）
- `SENTRY_AUTH_TOKEN`：source map 上傳用 token（建議只勾 Production + Preview；此為敏感值）

此步驟由使用者在 Vercel 後台操作，實作者僅提供清楚指引並等待使用者確認完成。

- [ ] **Step 2: 確認 Email 通知**

向使用者說明：Email 通知為 Sentry 預設，於 Sentry 後台 → Settings → Notifications 確認個人 Email 通知已開啟。無需改程式碼。

---

## Task 6: 端對端驗證

**Files:**
- 可能 Modify/Delete: wizard 產生的範例頁面（如 `app/sentry-example-page/`）

- [ ] **Step 1: 本機啟動並觸發前端錯誤**

Run: `npm run dev`
開瀏覽器到 wizard 產生的範例頁面（通常 `/sentry-example-page`），點擊觸發錯誤的按鈕。
Expected: 幾秒內 Sentry dashboard 出現一筆前端 issue。

- [ ] **Step 2: 驗證 Session Replay 與遮蔽**

在 Sentry dashboard 開啟該 issue。
Expected:
- 有附帶回溯錄影（Replay）
- 錄影中輸入欄位 / 文字被遮蔽（顯示為遮罩而非實際內容）

- [ ] **Step 3: 驗證 server 端錯誤**

觸發範例頁面的 server-side 錯誤（範例頁通常有 API route 按鈕）。
Expected: Sentry 出現一筆 server issue。

- [ ] **Step 4: 驗證 tRPC 過濾 — 預期錯誤不進 Sentry**

未登入狀態下，從前端觸發一個 `protectedProcedure`（會丟 `UNAUTHORIZED`「請先登入」）。
Expected: 前端正常顯示「請先登入」，Sentry **不**出現新 issue。

- [ ] **Step 5: 驗證 tRPC 過濾 — 非預期錯誤進 Sentry**

暫時在任一 procedure 開頭加 `throw new Error('sentry test')`，登入後觸發它。
Expected: Sentry 出現一筆帶 `trpcPath` tag 的 issue。
驗證後**移除**這行測試用 throw。

- [ ] **Step 6: 移除 wizard 範例頁面**

刪除 wizard 產生的範例頁面與範例 API route（如 `app/sentry-example-page/`、`app/api/sentry-example-api/`，實際路徑以 wizard 產生為準）。

Run: `npm run build`
Expected: 移除後 build 仍成功。

- [ ] **Step 7: 回歸驗證**

Run: `npm run build`
Expected: 成功。

Run: `npm test`
Expected: 現有 Playwright 測試通過（或與整合前相同的結果，無新增失敗）。

⚠️ 本次不 commit。完成後向使用者回報，由使用者決定是否 commit / 部署。

---

## Self-Review 結果

**Spec coverage：**
- 完整方案（錯誤+效能+Replay）→ Task 1（wizard 啟用全部）、Task 2（取樣率）
- 已有帳號/DSN → 前置需求 + Task 4 環境變數
- Vercel → Task 5
- Email 通知 → Task 5 Step 2
- tRPC 只送非預期錯誤 → Task 3 + Task 6 Step 4/5 驗證
- 取樣率 0.1 / 0 / 1.0 → Task 2
- 隱私遮蔽 → Task 2 Step 1
- 測試與驗證 5 項 → Task 6
- Next 16 / Turbopack 風險 → Task 1 Step 3/4（build 驗證）

無遺漏。

**Placeholder scan：** 無 TBD/TODO。使用者專屬值（DSN/token）於前置需求與 Task 4 明確要求向使用者索取，非 placeholder。

**Type consistency：** `EXPECTED_TRPC_CODES`、`onError({ error, path })`、`Sentry.captureException` 用法一致。
