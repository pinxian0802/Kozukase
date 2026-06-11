# IG 驗證改造：自動為主、人工為輔

日期：2026-06-11

## 目標

把 Instagram 驗證從「純自動掃收件匣」改成**自動為主、人工為輔**的混合流程：
大多數人按「我已傳送」後由系統自動掃收件匣秒過；自動掃不到的少數，落到管理員人工待審清單，
審核通過/退回後以站內通知告知賣家。管理員後台可看到完整的 IG 驗證紀錄（含自動與人工，標來源）。

對齊現有 Threads 人工審核的設計，並把 IG / Threads 後台合併成同一頁。

## 核心規則

- **15 分鐘過期只約束「產碼 → 按我已傳送」這一段**：產碼後 15 分鐘內沒按「我已傳送」，驗證碼作廢、要重產。
- **按下「我已傳送」即凍結過期**：之後無論自動掃到、或落人工待審，都永久有效、不再過期。
- 自動掃輪詢 **5 次（約 50 秒）**掃不到 → 落人工待審，**前端停止輪詢、純等人工**（零競態）。維持現狀，不拉長窗口。
- 後台紀錄**全部都記**（自動通過 + 人工通過 + 人工退回），並標**來源**（auto / manual）。

## 狀態對應（DB status ↔ 前台畫面）

| DB `status` | 前台畫面 | 說明 |
|---|---|---|
| `created` | 顯示驗證碼 + 15 分倒數 | 產碼了、還沒按「我已傳送」。`expires_at` 有效。 |
| `sent` | 自動掃中（等待確認） | 按了「我已傳送」，自動掃收件匣。`expires_at` 已清成 null（凍結）。 |
| `pending` | 審核中 | 自動掃 5 次沒中，落人工待審；出現在後台待審清單。 |
| `approved` | 驗證成功 | 自動掃到（`source=auto`）或人工通過（`source=manual`）。 |
| `rejected` | 已退回（可重新申請） | 人工退回（`source=manual`），帶 `reject_reason`。 |

## 1. 資料模型

新增一支 migration，**擴充現有 `ig_verification_codes` 表**（不新建表、不搬資料）：

```sql
ALTER TABLE ig_verification_codes
  ADD COLUMN IF NOT EXISTS status        text NOT NULL DEFAULT 'created', -- created|sent|pending|approved|rejected
  ADD COLUMN IF NOT EXISTS source        text,                            -- auto|manual（離開 sent 時填）
  ADD COLUMN IF NOT EXISTS reject_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by   uuid;

CREATE INDEX IF NOT EXISTS idx_ig_verif_status ON ig_verification_codes (status, created_at);
CREATE INDEX IF NOT EXISTS idx_ig_verif_seller ON ig_verification_codes (seller_id);

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ig_verification_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ig_verification_rejected';
```

- 既有欄位 `expires_at` / `verified_at` 保留：`expires_at` 只在 `created` 階段有意義，進 `sent` 時設為 null。
- `source` 在離開 `sent` 時填：自動掃到 → `auto`；落人工後人工通過或退回 → `manual`。
- 表維持 RLS enabled、不建任何 anon/authenticated policy（沿用現狀，僅 service-role 後端可存取）。

## 2. 後端 API（`app/api/instagram/verify/`）

- **`start` (POST)**：產碼，寫入 `status: 'created'`，`expires_at` 仍設 15 分鐘。
  - 重申請清理改成：刪掉此 seller **非 approved** 的舊筆（比照 Threads 的 `neq('status','approved')`），取代現在的 `verified_at is null`。
  - **重驗撤銷**：若此 seller 目前 `is_social_verified = true`，產新碼時即把 `sellers.is_social_verified` 設回 `false`（「一重驗就先撤銷」），審過才恢復。
- **`sent` (POST，新增)**：把該筆 `created → sent`、`expires_at = null`（凍結過期）。前端按「我已傳送」時呼叫；取代目前純前端的 `beginPolling` 起手。
- **`status` (GET，輪詢)**：
  - 僅對 `status=sent` 的筆去掃收件匣。
  - 掃到 → 更新 `sellers`（ig_handle / ig_user_id / ig_connected_at / is_social_verified=true）+ 該筆 `status=approved, source=auto, verified_at=now`，回 `{ verified: true }`。
  - 沒掃到 → 回 `{ verified: false }`（不再回 `expired`，因為 sent 已無期限）。
- **`escalate` (POST，新增)**：前端輪詢滿 5 次掃不到時呼叫，把該筆 `sent → pending`（落人工），回 `{ escalated: true }`。取代目前「5 次後判 failed + cancel」。
- **`pending` (GET，還原)**：回傳此 seller 最新一筆未結案的記錄（`status in (created, sent, pending, rejected)`），含 `status` / `code` / `expires_at` / `reject_reason`，前端據 `status` 還原對應畫面。
- **`cancel` (DELETE)**：照舊，刪除未結案（非 approved）的筆。

> `created` 階段的過期清理：沿用前端 15 分倒數歸零即呼叫 `cancel`；另可在 `start`/`pending` 順手清掉 `status=created` 且 `expires_at < now` 的殘留筆。

## 3. 前台（抽共用元件，profile + become-seller 共用）

現況：`app/(seller)/dashboard/profile/page.tsx` 與 `app/(user)/become-seller/page.tsx` 各有一份**複製貼上**的 IG 驗證狀態機（約 200 行 ×2）。本次抽成共用：

- 新增 **`useIgVerification` hook**（狀態機 + start/sent/輪詢/escalate/cancel/倒數/pending 還原）。
- 新增 **IG 驗證卡片元件**，承載各 step 的 UI。
- 兩頁改為引用此 hook + 元件。

狀態機調整：
- step：`idle → entering_username → loading_code → waiting_send → polling → success`（掃到）**或** `→ reviewing`（掃不到落人工）`→ rejected`（被退回，可重新申請）。
- **移除 `failed`**。
- **倒數只在 `waiting_send` 跑**；按「我已傳送」進 `polling` 即停掉倒數（修掉目前 polling 仍繼續倒數到 0 作廢的行為）。
- 按「我已傳送」先呼叫 `sent` 端點，成功後才開始輪詢。
- 輪詢滿 5 次 → 呼叫 `escalate` → 切 `reviewing`。
- `reviewing` / `rejected` 畫面沿用 Threads 現成樣式。

## 4. 後台（IG / Threads 合併為「社群驗證」一頁）

- 把 `app/(admin)/admin/threads-verification/` 重構為「社群驗證」頁，路由更名（例如 `/admin/social-verification`），最外層 Tab 切 **Instagram / Threads**，每個分頁內沿用現有「待審核 / 審核紀錄」結構。
- **更新 admin 側邊導覽連結**指向新路由。
- IG「審核紀錄」分頁多一欄 **來源**（🤖 自動 / 👤 人工）。
- `server/routers/admin.ts` 比照 Threads 新增：
  - `listIgVerifications`（`status=pending`）
  - `listIgVerificationHistory`（`status in (approved, rejected)`，可依 `reviewed_at` 日期篩選）
  - `approveIgVerification`：更新 `sellers` + 該筆 `status=approved, source=manual, reviewed_at/by` + 發 `ig_verification_approved` 通知。
  - `rejectIgVerification`：該筆 `status=rejected, source=manual, reject_reason, reviewed_at/by` + 發 `ig_verification_rejected` 通知。

## 5. 通知

新增 `ig_verification_approved` / `ig_verification_rejected` 兩種站內通知，payload 比照 Threads（含 ig_username、退回原因），套用現有通知顯示元件（需在通知渲染處補這兩型的文案）。

## 6. 範圍

- migration（擴充表 + enum）
- `app/api/instagram/verify/`：改 `start` / `status` / `pending` / `cancel`，新增 `sent` / `escalate`
- 前台共用：`useIgVerification` hook + IG 驗證卡片元件；改 profile、become-seller 兩頁
- 後台：合併頁重構 + 路由/導覽更新 + admin router 四支 procedure
- 通知渲染補兩型文案

## 取捨與不做

- **不拉長自動掃窗口**：維持 5 次/約 50 秒；接受 Graph API 延遲造成的少量誤判落人工。落人工後停止輪詢 → 零競態。
- **不新建第二張表**：避免兩表同步。
- 自動秒過仍保留即時「驗證成功」畫面。
```
