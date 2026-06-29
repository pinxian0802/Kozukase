# E2E 測試重新規劃 — 設計文件

- 日期：2026-06-27
- 狀態：規劃中（待 review）
- 方案：A（分層重整，保留現有 infra）
- 執行環境：維持打正式 Supabase（`[E2E]` 前綴 + teardown 自清）

---

## 一、背景與目標

現有 Playwright e2e 套件（14 個 spec）的**基礎建設其實是現代且健康的**，不需要重寫。問題集中在三處：

1. **脆弱選擇器** — `seller.spec.ts`、`cross-role.spec.ts` 以 `div[class*="rounded-["]` / `rounded-[28px]` 抓動態卡片。Design System v1（2026-05-21）後 class 會變動，這類選擇器易碎。
2. **淺測試重複** — 多支 spec 只驗「頁面渲染（header 可見即過）」，價值低又散落各檔。
3. **覆蓋缺口** — 較新或關鍵的流程沒測或只淺測：analytics 瀏覽計數、首頁 banner 輪播、IG 掃描比對、wishes 公開榜/許願頁、停權賣家連鎖、cron 過期下架、成為賣家 + onboarding 完整流程。

### 目標（四項並行）
- 修好脆弱選擇器（改用穩定 role/text + 少量 `data-testid`）
- 補齊新功能流程
- 深化主要流程（從「頁面渲染」升級成「端到端跑通 + DB 驗證」）
- 精簡與重整檔案結構

### 採用方案
**方案 A — 分層重整**：保留 infra，做三件事：①選擇器穩定化；②按優先級補關鍵旅程；③散落淺測試濃縮成單一 `smoke.spec`。

（已否決：B 全面重寫 page object model — 丟掉穩定 infra、成本最高、YAGNI；C 只修不補 — 達不到補齊新功能目標。）

---

## 二、保留 / 修改 / 新增 評估

### 保留（infra，不動）
| 檔案 | 角色 |
|------|------|
| `helpers/db.ts` | service-role seeding + DB 斷言（seedListing/Connection/Review、各種 count）|
| `helpers/trpc.ts` | 直打後端 mutation（驅動真實 publish/通知路徑）|
| `helpers/naming.ts` | `e2eName()` 產生 `[E2E]` 唯一名稱 |
| `helpers/cleanup.ts` | 清 `[E2E]` 列 + 還原被停權 seller |
| `fixtures.ts` | buyer/seller/admin 三角色 page fixture |
| `global.teardown.ts` | 最後防線清掃 |
| `playwright.config.ts` 的 project 分層與依賴順序 | 設計正確（setup → 角色 → auth 最後）|

### 修改
| 項目 | 動作 |
|------|------|
| `seller.spec.ts` | 移除 `rounded-[28px]` listingCard，改用 `data-testid`；深化生命週期 |
| `cross-role.spec.ts` | 移除未使用的 `listingCard` 殘留；選擇器穩定化 |
| 散落的「頁面渲染」smoke 測試 | 抽出集中到 `smoke.spec.ts` |
| `tests/README.md` | 更新（現況描述已過時，例如把 messages 寫成 basic flow）|

### 新增（覆蓋缺口）
- 真註冊（register→magic link token_hash→callback→onboarding）+ 忘記/重設密碼（recovery）— 用 `generateLink` 模擬點信，不靠真信箱
- 成為賣家完整流程
- 停權賣家連鎖
- analytics 瀏覽計數去重
- banner 輪播
- IG 掃描比對 / 社群驗證審核閉環
- wishes 公開榜 + 許願頁 + `/wishes/new`
- cron 過期下架（API/DB 層驗證）

---

## 三、選擇器策略

優先順序：`getByRole` > `getByText` / `getByPlaceholder` > `data-testid`（僅動態卡片/列）> CSS class（禁用）。

### 需新增的 `data-testid`（碰 production component，已獲核可）
在「依資料動態渲染、需按內容定位單一列/卡」的元件加穩定錨點：

| 元件 | testid 約定 |
|------|------------|
| 賣家代購管理列 | `data-testid="listing-row"` + `data-id={listing.id}` |
| 賣家連線管理列 | `data-testid="connection-row"` + `data-id={connection.id}` |
| admin 列表列（listings/connections/reports/products/sellers）| `data-testid="admin-row"` + `data-id={row.id}` |
| 通知列 | `data-testid="notification-item"` + `data-type={type}` |
| 評價卡（`components/review/review-list.tsx`）| `data-testid="review-item"` + `data-id={review.id}` |

對應提供測試 helper（`tests/helpers/locators.ts`）：

```ts
export const listingRow = (page, id) =>
  page.getByTestId('listing-row').filter({ has: page.locator(`[data-id="${id}"]`) })
// 或元件直接把 data-id 放在 testid 元素本身：page.locator(`[data-testid="listing-row"][data-id="${id}"]`)
```

統一由 `helpers/locators.ts` 匯出，禁止各 spec 自行硬寫 class 選擇器。

---

## 四、測試優先級分層

每條註明：驅動方式（UI / seed / trpc）與斷言點（UI 可見 / DB poll）。

### P0 — 核心交易路徑（壞了平台不可用）

| # | 流程 | 驅動 | 斷言 | 檔案 |
|---|------|------|------|------|
| 1 | Email 登入成功 → 整頁導向、Header 換新帳號 | UI | URL/Header | `auth.spec.ts` |
| 2 | 登出 → session 清除（auth project 最後跑）| UI | redirect to login | `auth.spec.ts` |
| 3 | 真註冊：register 頁送 email→「驗證信已寄出」；magic link token_hash→callback→建 profiles→onboarding 設 username **＋密碼**（Email/`provider=email` 用戶在 onboarding 必設密碼；Google 用戶無此步） | UI + `generateLink` | DB profiles + redirect | `registration.spec.ts`（新）|
| 3b | 忘記密碼→「重設連結已寄出」；recovery token_hash→callback→reset-password 設新密碼→新密碼可登入 | UI + `generateLink` | UI + 新密碼登入成功 | `password-reset.spec.ts`（新）|
| 4 | 買家詢問旅程：搜尋→商品→代購詳情→「詢問」開訊息(帶 context)→送訊息 | UI | DB messages + context 欄位 | `buyer-journey.spec.ts`（新/併 messages）|
| 5 | 即時收訊（買賣兩 context，不刷新即收）| UI 雙 page | UI 可見 | `messages.spec.ts`（保留）|
| 6 | 成為賣家四步驟 → sellers/seller_regions 建立 → 導向社群驗證 | UI | DB sellers + seller_regions | `become-seller.spec.ts`（新）|
| 7 | 賣家單表單上架代購（選/建商品+圖排序）→ active → 搜尋找得到 | UI | DB listings + 搜尋頁可見 | `seller-create.spec.ts`（保留深化）|
| 8 | 上架代購 → 許願該商品買家收 `new_listing_for_wish` | trpc publish | DB notification count | `cross-role.spec.ts`（保留）|
| 9 | 賣家發布連線 → 連線瀏覽找得到 → 詳情頁 | UI/seed | UI 可見 | `seller.spec.ts` |

### P1 — 審核與治理

| # | 流程 | 驅動 | 斷言 | 檔案 |
|---|------|------|------|------|
| 10 | admin 審核 pending 代購/連線 → active + 賣家收通知 | seed pending + admin UI | DB status + notification | `admin-listings/connections.spec.ts`（保留）|
| 11 | admin 下架 → 賣家編輯頁「重新送出審核」→ pending_approval | seed + UI | DB status | `cross-role.spec.ts`（保留）|
| 12 | admin 刪商品連鎖：listing→product_removed + 許願取消 + 通知 | seed + admin UI | DB 多表 | `cross-role.spec.ts`（保留深化：補許願取消+通知斷言）|
| 13 | **停權賣家連鎖**：代購下架/連線結束/搜尋隱藏/通知 | seed + admin UI | DB 多表 + 搜尋頁不可見 | `admin-suspend.spec.ts`（新）|
| 14 | 檢舉防濫用：重複 pending 擋下、每日 20 上限 | trpc | DB / 錯誤碼 | `report-takedown.spec.ts`（保留）|
| 15 | 檢舉處理：pending → resolved / dismissed（admin note）| seed + admin UI | DB status | `admin-reports.spec.ts`（保留）|

### P2 — 互動與計數正確性

| # | 流程 | 驅動 | 斷言 | 檔案 |
|---|------|------|------|------|
| 16 | 許願 +1 / wish_count 同步 / 上限 20 擋下 | UI + trpc | DB wish_count / 錯誤 | `buyer.spec.ts`（保留+補上限）|
| 17 | 收藏三類（商品/代購/連線）+ 收藏頁四分頁 | UI | DB bookmarks | `buyer.spec.ts` |
| 18 | 追蹤（唯一）| UI | DB follows | `buyer.spec.ts`（保留）|
| 19 | 評價：一賣家一評價、avg_rating/review_count 同步、賣家回覆、按讚唯一 | UI | DB sellers 統計 | `buyer.spec.ts`（保留+補回覆/按讚）|
| 20 | **analytics 瀏覽計數去重**（product/listing/connection/profile_views，同 session 去重、排除本人）| UI | DB *_views count | `analytics.spec.ts`（新，部分已在 buyer.spec）|
| 21 | 社群驗證閉環：送出→待審→admin 核准/退回→賣家通知 | UI + admin UI | DB + notification | `threads-verification.spec.ts`（保留）+ `ig-verification.spec.ts`（新）|
| 22 | IG 掃描比對：admin「掃描比對 IG 收件匣」批次命中自動通過 | admin UI（需 mock/skip 外部 IG）| DB / 明細視窗 | `ig-verification.spec.ts`（新，外部依賴需評估）|

### P3 — 周邊與基礎

| # | 流程 | 驅動 | 斷言 | 檔案 |
|---|------|------|------|------|
| 23 | SEO 結構化資料 / 各頁 title / OG 圖 | UI | meta 標籤 | `seo.spec.ts`（保留）|
| 24 | 孤兒圖片清理（掃描列出 + 刪除）| trpc/admin | DB/R2 | `storage.spec.ts` + `orphan-images.unit.spec.ts`（保留）|
| 25 | **banner 輪播**：admin 上架/排序 → 首頁 hero 顯示；無上架資料則隱藏 | admin UI + 首頁 | DB home_banners + UI | `banner.spec.ts`（新）|
| 26 | **cron 過期下架**：到期商品下架 + 連線結束 | 直呼 `/api/cron/expire-daily` + DB | DB status | `cron-expire.spec.ts`（新，API 層非 UI）|
| 27 | wishes 公開榜 + 許願詳情 + `/wishes/new` 流程 | UI | DB wishes + UI | `wishes.spec.ts`（新）|
| 28 | smoke：所有主要頁面渲染（集中濃縮）| UI | header/main 可見 | `smoke.spec.ts`（新，吸收散落淺測試）|

---

## 五、重整後檔案結構

```
tests/
  helpers/            # 保留 + 新增 locators.ts
    db.ts trpc.ts naming.ts cleanup.ts r2.ts
    locators.ts       # 新：data-testid 共用 locator
  setup/              # 保留
  smoke.spec.ts       # 新：集中淺渲染測試（P3-28）
  auth.spec.ts        # 保留
  registration.spec.ts # 新（P0-3：真註冊 generateLink + onboarding）
  password-reset.spec.ts # 新（P0-3b：忘記/重設密碼 generateLink recovery）
  become-seller.spec.ts # 新（P0-6）
  buyer.spec.ts       # 保留深化（P2-16~19）
  buyer-journey.spec.ts # 新或併入 messages（P0-4）
  seller.spec.ts      # 保留，去 class 選擇器（P0-9, P1）
  seller-create.spec.ts # 保留深化（P0-7）
  messages.spec.ts    # 保留（P0-5）
  cross-role.spec.ts  # 保留深化（P0-8, P1-11/12）
  admin-listings.spec.ts admin-connections.spec.ts # 保留（P1-10）
  admin-reports.spec.ts report-takedown.spec.ts    # 保留（P1-14/15）
  admin-suspend.spec.ts # 新（P1-13）
  analytics.spec.ts   # 新（P2-20）
  threads-verification.spec.ts # 保留（P2-21）
  ig-verification.spec.ts # 新（P2-22，視外部依賴）
  wishes.spec.ts      # 新（P3-27）
  banner.spec.ts      # 新（P3-25）
  cron-expire.spec.ts # 新（P3-26）
  seo.spec.ts storage.spec.ts orphan-images.unit.spec.ts # 保留
```

`playwright.config.ts` 的 `cross-role` project `testMatch` 需把新檔（admin-suspend、analytics、wishes、banner、cron-expire、registration、password-reset、become-seller、smoke、ig-verification）納入。

---

## 六、明確不做（YAGNI）

- 不導入 page object model（infra 已夠用）
- 不改執行環境（不導入 branch/seed DB；維持打正式 Supabase）
- 不追求 100% 路由覆蓋；smoke 確保渲染，重點放主要流程深度
- 不測 Google OAuth 真實第三方流程（只驗 callback 路由邏輯，OAuth 本身屬外部）
- 不為「機制保留、尚未實作」的 `expired` 等狀態寫測試

---

## 七、待釐清 / 風險

1. **社群驗證（P2-21/22）**（已查證真實 schema/路由）：無 `social_verifications` 表，實際為 `threads_verification_requests`/`ig_verification_codes`；唯一路由 `/admin/social-verification`（外層 Instagram/Threads tab）。**既有 `threads-verification.spec.ts` 指向已不存在的 `/admin/threads-verification`、目前壞掉**，需修路由。IG 掃描比對依賴管理員真實 IG 收件匣 + token，無法穩定 e2e → 只驗掃描鈕存在，真實命中標 `test.fixme`。
2. **註冊 / 重設密碼用 `auth.admin.generateLink`** — 取 `token_hash` 直接訪問 `/callback` 模擬點信，不依賴真實信箱（層次 1 測 register/forgot UI、層次 2 測 callback→verifyOtp→建檔/導向，層次 3 真信箱不做）。callback `type` 對齊正式信件範本（magic link 用 `email`、recovery 用 `recovery`）；若 `type=email` 驗證失敗則改 `magiclink`。
3. **become-seller 需「乾淨帳號」** — 現有三帳號是長期共用、已是 seller。測內建臨時帳號（service-role `admin.createUser`，登入頁用 password）並於 teardown `admin.deleteUser`。
4. **cron 過期下架** 需 `CRON_SECRET` 或可直呼路由；確認本地 dev 是否放行；若 `expired` 邏輯未實作則標 `test.fixme`。
5. 新增 `data-testid` 會碰多個 production component，須與既有 DOM 結構相容、不影響樣式。

---

## 八、建議執行順序

1. 選擇器穩定化（加 testid + `helpers/locators.ts`）→ 讓現有 spec 不再脆弱
2. P0 補齊（registration、password-reset、become-seller、buyer-journey）
3. P1 補齊（admin-suspend、深化 cross-role 連鎖斷言）
4. P2 補齊（analytics、ig-verification、深化 buyer 互動）
5. P3 補齊（wishes、banner、cron、smoke 濃縮）
6. 更新 `tests/README.md` 與 `docs/platform-overview.md`（測試章節）
