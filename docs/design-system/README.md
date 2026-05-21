# Kozukase Design System

> 一份 Kozukase 前端 UI 的「字母表 + 常用詞」：token 是字母、variant 是常用詞、pattern 是常用句子。

**Source of truth**：
- Tokens：[`app/globals.css`](../../app/globals.css)
- Spec：[`docs/specs/2026-05-21-design-system-plan.md`](../specs/2026-05-21-design-system-plan.md)

---

## 文件索引

| 文件 | 內容 |
|---|---|
| [tokens.md](./tokens.md) | 顏色 / 間距 / 字級 token 完整清單 + Tailwind class 對應 |
| [components.md](./components.md) | `components/ui/` 元件清單 + 可用 variants 速查 |
| [patterns.md](./patterns.md) | 高頻 UI 組合（卡片列表、表單、空狀態、頁面標頭…）|
| [migration.md](./migration.md) | 84 個原始 hex → token 對照表（Phase 2 遷移用）|

---

## 設計哲學

1. **永遠用 semantic token，避免硬碼 hex**
   - 寫 `bg-surface-card` 不寫 `bg-white`
   - 寫 `text-text-muted` 不寫 `text-[#888]`
   - 例外：第三方服務色（Google/LINE）統一收進 `lib/constants/brand-colors.ts`

2. **元件需要新樣式時，加 variant，不要寫 className**
   - 寫 `<Button variant="cta-outline">` 不要 `<Button className="border-brand-500 text-brand-700 ...">`
   - 缺 variant 就在 `components/ui/` 加，不要 inline override

3. **三層 token 結構**
   ```
   Raw scale          --brand-500 / --neutral-300 / --success-500
        ↓
   Semantic           --text-strong / --surface-card / --border-soft / --cta
        ↓
   Tailwind utility   bg-surface-card / text-text-strong / border-border-soft
   ```
   元件應該用 **semantic 層**；只有設計時臨時需要色階調整才下到 raw。

4. **品牌色 = teal `#26C8C2`**
   - Primary 是黑（`--primary`），用於一般按鈕
   - CTA / brand 是 teal（`--cta` / `--brand`），用於「需要動作」的位置（主 CTA、active tab、focus ring）
   - Dark mode 不維護

---

## 何時更新這份系統

- **加新顏色** → 改 `globals.css` token 層 + 更新 `tokens.md`
- **元件加新 variant** → 改該元件 `cva()` + 更新 `components.md`
- **發現新的 UI 組合 pattern** → 加進 `patterns.md`
- **重大架構決策** → 寫進 `docs/specs/` 新 spec 並連回 README

---

## 何時 *不要* 更新

- 一次性頁面 UI 微調 → inline className 就好
- 實驗中的新設計 → 等定案再進 token / variant
- 第三方元件樣式覆寫 → 不算 DS 範圍

---

## 變更歷史

| 日期 | 變更 |
|---|---|
| 2026-05-21 | Design System v1 啟動，Phase 1+2 完成 |
