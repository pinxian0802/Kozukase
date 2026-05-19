# Kozukase Codebase 完整稽核報告

> 掃描日期：2026-05-16
> 範圍：型別錯誤、邏輯錯誤、安全漏洞、運營疑慮
> 方法：全 codebase 靜態審查 + `tsc --noEmit` + Supabase 線上 DB 實查 + security advisor

---

## 架構前提（影響所有判讀）

tRPC 全部使用 **service role key**（`server/db/client.ts:15`）連線資料庫，**繞過所有 RLS**。
因此網站 UI 路徑的安全性，完全依賴：

1. 每個 procedure 的權限層級（`protectedProcedure` / `sellerProcedure` / `adminProcedure`）
2. 每個查詢手動加上 `.eq('user_id', ...)` 等過濾條件

整體實作品質不錯，但有數個破口，詳列如下。

---

## 🔴 嚴重（上線前必須處理）

### 1. `get-ig-token` 是公開、無驗證的 token 外洩端點

- **檔案**：`app/api/admin/get-ig-token/route.ts`
- **問題**：此 route 無任何身份驗證。任何人打開此 URL 走完 OAuth 流程，網頁會直接以 HTML 印出**長效 Instagram admin token、account ID、handle**。
- **現況**：檔案註解自述「取完 token 後請刪除」，但檔案仍存在於 codebase。
- **修法**：上線前**刪除整個檔案**；若仍需重新取得 token，改用本機腳本或加上 `adminProcedure` 等級驗證。

### 2. RLS 啟用機制未納入 migration（重建環境＝全資料外洩）

- **線上現況（已實查）**：Supabase 專案 `odetecnsfwvugnrfynmi` 的 24 張 public 表 RLS **全部已啟用**，正式站目前安全。
- **問題**：RLS 啟用是靠一個手動建立的 event trigger `rls_auto_enable()`（DDL 結束時自動對新建 public 表 `ENABLE ROW LEVEL SECURITY`）。此 trigger 與函式**完全沒有出現在任何 migration 檔**。migration 內僅 5 張表有顯式 `ENABLE ROW LEVEL SECURITY`：`conversations`、`messages`、`connection_bookmarks`、`social_tokens`、`ig_verification_codes`。
- **風險**：從 migration 在新環境（本機 / CI / 災難復原 / 換 Supabase 專案）重建 DB 時，event trigger 不存在 → 其餘 ~20 張表變成「有 policy 但 RLS 未啟用」。`NEXT_PUBLIC_SUPABASE_ANON_KEY` 為公開金鑰，且前端確有使用瀏覽器端 Supabase client 跑 Realtime（`components/shared/notification-bell.tsx`、`components/message/conversation-panel.tsx` 等）→ 任何人可直接 `supabase.from('reports'/'notifications'/'wishes'/'reviews').select('*')` 讀寫全表（含檢舉內容、通知、許願等隱私資料）。
- **修法**：把 `rls_auto_enable()` + event trigger，或各表的 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`，補進 migration。

---

## 🟠 中等

### 3. Cron 端點在 secret 未設時 fail-open

- **檔案**：`app/api/cron/expire-listings/route.ts:6`、`app/api/cron/expire-connections/route.ts:6`
- **問題**：`CRON_SECRET` 未設時 `expected = "Bearer "`，攻擊者送出 `Authorization: Bearer `（7 字元）即通過 `timingSafeEqual`。
- **修法**：`CRON_SECRET` 為空時直接 401 拒絕。

### 4. Cursor 分頁邏輯全面錯誤

- **檔案**：`lib/utils/pagination.ts` + 多個 router
- **問題**：cursor 編碼了 id（+ 可選 sortValue），但所有呼叫端 `ORDER BY created_at`（或 `wish_count`）卻用 `.lt('id', cursorId)` 過濾，且從不使用 sortValue。因 id 為隨機 UUID，與排序欄位無關，**無限捲動會跳過 / 重複 / 遺漏資料**。
- **受影響**：`listing.myListings`、`review.getBySeller`、`review.myReviews`、`wish.myWishes`、`wish.topWished`、`seller.getListings`、`notification.list`。
- **修法**：改為 keyset pagination（以排序欄位 + id 做複合游標），或改用 offset 分頁。

### 5. `product.browse` 篩選器靜默失效

- **檔案**：`server/routers/product.ts:54-77`
- **問題**：對 `listings.price`、`listings.shipping_date`、`listings.seller.is_social_verified`、`listings.seller_id` 下篩選，但 `select` 未 embed `listings`（更未用 `!inner`）。PostgREST 對未 inner-join 的關聯下篩選不生效 → 買家的價格 / 出貨 / 社群驗證 / 地區篩選**實際上沒有過濾作用**。
- **修法**：select 改用 `listings!inner(...)` 並把篩選掛在 inner-join 關聯上。

### 6. `connection.getById` 資訊外洩

- **檔案**：`server/routers/connection.ts:161`
- **問題**：為 `publicProcedure`，且**不檢查 status，也不檢查賣家是否停權**（對照 `listing.getById:294-301` 有檢查 draft / suspension）。已結束、被 admin 下架、或停權賣家的 connection，仍能用直接 API/URL 完整讀取。
- **修法**：比照 `listing.getById` 加上 status 與賣家停權檢查。

### 7. 18 個 DB function 未設 `search_path`（Supabase advisor WARN）

- **問題**：`search_products`、`replace_listing_images`、`update_*`、`check_*` 等 SECURITY DEFINER 函式 `search_path` 可變，有 search_path hijack 風險。
- **修法**：全部加 `SET search_path = ''`（或 `pg_catalog, public`）。

---

## 🟡 較小 / 型別錯誤

### TypeScript 編譯錯誤（`npx tsc --noEmit`，共 10 個）

| 檔案:行 | 問題 |
|---|---|
| `lib/validators/listing.ts:48` | Zod v4 已移除 `required_error`（須改用 `error`/`message`），自訂錯誤訊息實際無效 |
| `app/(buyer)/search/page.tsx:346` | `brand` 型別不符（`{name}[]` vs `string\|{name}\|null`） |
| `app/(admin)/admin/today/page.tsx:142,160` | 參數 `p` implicit `any` |
| `components/message/context-card.tsx:62,100,126` | 參數 `a`/`b`/`loc` implicit `any` |

### 其他

- **`becomeSeller` 假驗證**：`server/routers/seller.ts:29` `phone_verified: true // TODO: implement OTP verification`，所有賣家自動標記手機已驗證。
- **`review.create` 無交易前提**：任何登入者可對任意賣家評價，無防刷評 / 防洗評機制。
- **IG 驗證碼強度不足**：`app/api/instagram/verify/start/route.ts:27` 用 `Math.random()` 產 4 位數碼，且 start 端點未見 rate limit。靠 IG DM 來源比對降低風險，建議改用 `crypto` 並加頻率限制。
- **無安全標頭**：`next.config.ts` 未設定 CSP / HSTS / X-Frame-Options 等。
- **`rls_auto_enable()` 可被 anon 經 RPC 呼叫**（advisor WARN）；實務上 event trigger 函式無法被有意義地直接呼叫，建議仍 `REVOKE EXECUTE FROM anon, authenticated`。
- **Supabase Auth 外洩密碼防護未開啟**（HaveIBeenPwned，advisor WARN）。
- **`brands` / `connection_brands` 啟用 RLS 但 0 policy**：tRPC（service role）正常，但任何前端直接讀這兩張表會全空。

---

## ✅ 做得好的部分

- tRPC 權限分層（`protected` / `seller` / `admin`）正確；admin 判定用 `app_metadata.role`（使用者不可竄改）
- Social token 採 AES-256-GCM 加密、隨機 IV、auth tag 正確（`lib/utils/social-tokens.ts`）
- 上傳流程嚴格驗證 R2 key 前綴歸屬、URL 比對、`..` 阻擋（`server/routers/upload.ts`）
- OAuth state CSRF 檢查、open-redirect 防護（`lib/supabase/auth-error.ts` `getSafeNextPath`）
- message / notification / bookmark / follow 等 router 皆正確以 `ctx.user.id` 限縮
- 正式站 RLS 實際為開啟狀態（已用 SQL 確認）

---

## 建議處理順序

1. 刪除 `get-ig-token`（風險最高、改動最小）
2. RLS 啟用補進 migration
3. Cron fail-open 修正
4. Cursor 分頁重寫
5. `product.browse` 篩選修正
6. 修掉 10 個 tsc 型別錯誤
7. 其餘中小項目逐步處理
