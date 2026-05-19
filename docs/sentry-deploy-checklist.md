# Sentry 部署檢查清單

部署到 Vercel 前 / 後要做的事。程式整合已完成（見 `docs/platform-overview.md` 第九節），這份只列**部署時的手動步驟**。

Sentry 組織：`pinxian-chiang`　專案：`kozukase`
Dashboard：https://pinxian-chiang.sentry.io/projects/kozukase/

---

## 1. Vercel 環境變數（必做，否則上線後不會回報 / source map 無法還原）

Vercel → 專案 → Settings → Environment Variables，新增兩個：

| 變數 | 值來源 | 勾選環境 | 備註 |
|------|--------|----------|------|
| `NEXT_PUBLIC_SENTRY_DSN` | 本機 `.env.local` 同一串 | Production + Preview + Development | 前後端共用，非敏感 |
| `SENTRY_AUTH_TOKEN` | 本機 `.env.local` 同一串 | Production + Preview | source map 上傳用，**敏感值**，不要勾 Development |

> 兩個值直接從本機 `Kozukase/.env.local` 的 `# Sentry` 區塊複製。
> `.env.local` 不會進 git，所以 Vercel 一定要手動設，不會自動帶上去。

設定後需 **重新 deploy** 一次才會生效。

## 2. Sentry 後台 Email 通知（確認即可，免改程式）

Sentry → Settings → Notifications → 確認個人 Email 通知為開啟（預設就開）。
這樣 production 出錯時你信箱會收到通知。

## 3. 部署後驗證（建議做一次）

1. 部署完成後，開線上網站任一頁，正常操作確認沒壞。
2. 故意觸發一個錯誤（或等真實錯誤），到 Sentry Dashboard 確認：
   - Issues 有出現該筆錯誤
   - 點進去 stack trace 能還原成原始 TypeScript 行號（代表 source map 上傳成功 → `SENTRY_AUTH_TOKEN` 設對了）
3. 確認 Email 有收到通知。

---

## 常見問題

- **線上錯誤沒進 Sentry**：多半是 Vercel 沒設 `NEXT_PUBLIC_SENTRY_DSN`，或設完沒重新 deploy。
- **stack trace 是壓縮後亂碼、對不到原始碼**：`SENTRY_AUTH_TOKEN` 沒設或 token 失效，source map 沒上傳。重設 token 後重新 deploy。
- **Sentry 一直冒「請先登入 / 權限不足」之類雜訊**：不該發生——這些預期錯誤已在 `app/api/trpc/[trpc]/route.ts` 白名單過濾掉；若出現代表該檔被改壞，檢查 `EXPECTED_TRPC_CODES`。
- **build 警告 `disableLogger is deprecated`**：Sentry 10 對 Turbopack 的非阻塞 warning，不影響功能，可日後改用 `webpack.treeshake.removeDebugLogging`。

## 取樣設定（已寫死在程式，部署不用改，僅供參考）

- 效能追蹤 `tracesSampleRate: 0.1`（10%，控管 Sentry 額度）
- 一般 session 不錄影 `replaysSessionSampleRate: 0`
- 出錯才回溯錄影 `replaysOnErrorSampleRate: 1.0`
- Session Replay 全程遮蔽文字與媒體（`maskAllText` / `blockAllMedia`）

若之後流量大、Sentry 額度吃緊，調低 `tracesSampleRate`（在 `instrumentation-client.ts`、`sentry.server.config.ts`、`sentry.edge.config.ts`）。
