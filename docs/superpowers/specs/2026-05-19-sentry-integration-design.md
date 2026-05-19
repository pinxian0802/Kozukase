# Sentry 整合設計

日期：2026-05-19
狀態：已核准設計，待撰寫實作計畫

## 目標

整合 Sentry 到專案，讓 production 發生錯誤時開發者能即時得知並重現問題。

## 需求總結

- 完整方案：錯誤追蹤 + 效能監控 + Session Replay
- 使用者已有 Sentry 帳號與專案（已有 DSN）
- 部署平台：Vercel
- 通知方式：Email（Sentry 預設，無需寫程式，於 Sentry 後台設定）

## 技術背景

- Next.js 16.2.3，App Router
- tRPC v11（server + client），Supabase auth/db，React 19
- 目前**無**任何 error boundary（無 `app/error.tsx` / `app/global-error.tsx`）
- 目前**未**整合 Sentry
- dev script：`next dev --webpack`；build：`next build`
- 測試：Playwright

## 方案選擇

採用**官方 `@sentry/nextjs` SDK，完整自動整合**。

替代方案與否決原因：
- 手動最小化安裝：容易漏設定（source map、edge runtime），維護成本高
- 只做錯誤捕捉（不含 Replay/效能）：不符合使用者要的完整方案

## 架構與檔案

Next.js 16 採用新的 instrumentation 機制。新增/修改的檔案：

| 檔案 | 用途 |
|---|---|
| `instrumentation-client.ts` | 瀏覽器端 `Sentry.init`（含 Session Replay） |
| `sentry.server.config.ts` | Node server 端 init |
| `sentry.edge.config.ts` | Edge runtime（middleware）端 init |
| `instrumentation.ts` | 註冊 server/edge config + `onRequestError`（捕捉 RSC / Server Action 錯誤） |
| `app/global-error.tsx` | 全域 React 錯誤邊界（新增） |
| `next.config.ts` | 以 `withSentryConfig` 包裝，啟用 source map 上傳 |
| `app/api/trpc/[trpc]/route.ts` | 加 `onError` 把非預期 tRPC 錯誤送 Sentry |
| `.env.local` / `.env.example` | 環境變數 |

### 環境變數

- `NEXT_PUBLIC_SENTRY_DSN`：Sentry DSN（client + server 共用）
- `SENTRY_AUTH_TOKEN`：source map 上傳用，設在 Vercel，**不進 git**
- Sentry org / project 名稱：設定於 `withSentryConfig`

## 捕捉範圍

會被捕捉的錯誤：
- 前端 React render 錯誤、未處理的 Promise rejection（`global-error.tsx` + client init）
- Server Component / Server Action / route handler 錯誤（`onRequestError`）
- tRPC procedure 拋出的非預期錯誤（`route.ts` 的 `onError`）

### tRPC 錯誤過濾（關鍵）

現有程式碼用 `TRPCError` 做正常流程控制：
- `UNAUTHORIZED`：「請先登入」
- `FORBIDDEN`：「需要賣家身份」、「帳號已被停權」、「需要管理員權限」

這些是預期行為，**不送** Sentry，避免告警被雜訊淹沒。只送 `INTERNAL_SERVER_ERROR`（或非預期 code）的錯誤。

## 取樣率

考量 Vercel / Sentry 額度：

| 設定 | 值 | 說明 |
|---|---|---|
| `tracesSampleRate` | `0.1` | 10% 請求做效能追蹤，避免吃光額度 |
| `replaysSessionSampleRate` | `0` | 不主動錄製一般 session |
| `replaysOnErrorSampleRate` | `1.0` | 出錯才回溯錄製，100% |
| 錯誤回報 | 100% | 錯誤本身不取樣 |

## 隱私

Session Replay 維持預設遮蔽：`maskAllText`、`blockAllMedia`，避免錄到使用者個資 / 密碼 / 輸入內容。

## 測試與驗證

整合性質為主，傳統單元測試 ROI 低，不寫自動化測試。驗證方式：

1. **本機驗證**：臨時測試路由/按鈕故意丟錯，確認 client + server 兩端都進 Sentry，驗證後移除
2. **tRPC 過濾驗證**：觸發 `UNAUTHORIZED` → 不進 Sentry；故意丟非預期錯誤 → 進 Sentry
3. **Source map 驗證**：`next build` 後確認 Sentry stack trace 還原成原始 TypeScript 行號
4. **Session Replay 驗證**：觸發前端錯誤，確認有回溯錄影且輸入欄位被遮蔽
5. **回歸**：`npm run build` 仍成功、現有 Playwright 測試不受影響

## 實作風險 / 待驗證

- Next.js 16.2.3 很新，需確認所用 `@sentry/nextjs` 版本對 Next 16 的支援程度
- Turbopack vs webpack 的 source map 上傳行為（dev 用 `--webpack`，build 行為需驗證）
