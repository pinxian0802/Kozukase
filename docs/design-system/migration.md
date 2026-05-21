# Hex → Token 對照表

**Date**: 2026-05-21
**Status**: Phase 1.3
**用途**：Phase 2 大遷移時的逐檔替換指引。84 個獨立 hex → 收斂到 ~15 個 token。

---

## 1. 中性灰（Neutral）

| 原 hex | 出現處 | → Token | Tailwind class |
|---|---|---|---|
| `#0a0a0a`, `#111`, `#1a1a1a`, `#222` | 主文字 | `--text-strong` | `text-text-strong` |
| `#333`, `#444`, `#555` | 次要文字 / 標題 | `--text-muted` (`--neutral-700`) | `text-text-muted` |
| `#666`, `#777`, `#888` | 一般說明文字 | `--text-muted` (`--neutral-600`) | `text-text-muted` |
| `#999`, `#9a9a9a`, `#aaa`, `#bbb`, `#9CA3AF` | placeholder / caption | `--text-faint` (`--neutral-500`) | `text-text-faint` |
| `#ccc`, `#dcdcdc`, `#d2d7df` | 邊框（強） | `--border-strong` (`--neutral-300`) | `border-border-strong` |
| `#e0e0e0`, `#e2e2e2`, `#e4e4e4`, `#e8e8e8`, `#dde1e7` | 邊框（一般） | `--border-soft` (`--neutral-200`) | `border-border-soft` |
| `#ececec`, `#f0f0f0` | 細邊框 / 分隔 | `--border-soft` | `border-border-soft` |
| `#f5f5f5`, `#f7f7f7` | 中性 hover 底 | `--surface-muted` (`--neutral-100`) | `bg-surface-muted` |
| `#fafafa`, `#FAFAFD` | 頁底 | `--surface-page` (`--neutral-50`) | `bg-surface-page` |
| `#fff` | 卡片 / overlay | `--surface-card` (`--neutral-0`) | `bg-surface-card` |
| `#c5cad3`, `#444e5a` | 冷色灰（active chip） | `--text-muted` + `--border-soft` | 視情境 |

---

## 2. 暖中性（Warm beige，目前散落 ~12 個）

> **決策**：先收進中性 token；保留警示——若 UI 設計確認要走「暖色基底」再單獨開 `--warm-*` token，目前不開。

| 原 hex | 用途 | → Token |
|---|---|---|
| `#fbfaf8`, `#fafaf6`, `#fafaf8`, `#f8f6f3`, `#faf9f7` | 暖白頁底 | `--surface-page` |
| `#f4f2ee`, `#f1ede5`, `#f0ede7`, `#eeebe4` | 暖卡片底 / hover | `--surface-muted` |
| `#e8e5e0`, `#e6e2dc`, `#e8e3dc`, `#e0dbd3`, `#dedad4` | 暖邊框 | `--border-soft` |
| `#ccc8c0`, `#d4cfc9` | 暖邊框（強） | `--border-strong` |
| `#ebe6dd`, `#e1ddd7` | 卡片邊框 | `--border-soft` |

---

## 3. Teal（不一致的品牌色變體）

> **重點**：原本散落 5 種「都想當品牌色」的 teal，全部統一到 `--brand-*` scale。

| 原 hex | 出現處 | → Token |
|---|---|---|
| `#26C8C2` | search 頁 KZ.teal | `--brand-500` |
| `#28a5cf`, `#2da6cf` | 「查看更多分類」按鈕邊 | `--brand-500` |
| `#1a9ac4`, `#168eb4` | hover 深 teal | `--brand-700` |
| `#4ab0a9` | 另一個 teal 變體 | `--brand-500` |
| `#3ecfcf` | 亮 teal | `--brand-500` |
| `#f4fbfe` | teal hover 底 | `--brand-50` |

---

## 4. KZ palette（搬到 token 或刪除）

| 原 hex | KZ 名 | 用途 | → 處理 |
|---|---|---|---|
| `#26C8C2` | teal | 主品牌色 | `--brand-500`（已進 token） |
| `#F0387A`, `#e94aa1` | pink | 品牌 chip / 互動 | **保留**，新增 `--accent-pink-*` token（Phase 4 處理）|
| `#8B24C0`, `#9b5fc8` | purple | （未使用） | **刪除** |
| `#F97316`, `#f4821f` | orange | （未使用） | **刪除** |
| `#F5C200`, `#f5c518` | yellow | （未使用） | **刪除** |
| `#7DC83A`, `#72c442` | green | （未使用） | **刪除** |

---

## 5. Status（狀態色）

| 原 hex | 語意 | → Token |
|---|---|---|
| `#2563EB`, `#1a4a8a`, `#1e3a5f` | info 藍 | `--info` / `--info-soft` |
| `#EFF6FF` | info 淺底 | `--info-soft` |
| `#34A853`, `#00b900` | success 綠 / LINE | `--success` / 保留 LINE 服務色 |
| `#b45309`, `#C2410C`, `#7c2d12` | warning 橘 | `--warning-soft-foreground` |
| `#FFF7ED` | warning 淺底 | `--warning-soft` |
| `#EA4335` | destructive 紅 / Google | 保留 Google 服務色；destructive 用 `--destructive` |

---

## 6. 第三方服務色（保留）

> 這些代表「該服務的品牌色」，**不要動**——但統一抽到 `lib/constants/brand-colors.ts`。

| 原 hex | 服務 |
|---|---|
| `#4285F4`, `#34A853`, `#FBBC05`, `#EA4335` | Google（OAuth 按鈕）|
| `#00b900` | LINE |
| `#1877F2` 等 | Facebook（若存在）|

---

## 7. Dark navy（admin 後台主題？需確認）

| 原 hex | 用途 | → 處理 |
|---|---|---|
| `#0f1a36`, `#1e3a5f`, `#2d3a5e` | admin 後台側欄/主題 | **Phase 2 進到該檔時再決定**：要嘛收進 `--surface-card-inverse`、要嘛確認是 admin 專屬保留 |

---

## 待辦

- [ ] Phase 4 確認 pink 是否要進 token（取決於使用範圍）
- [ ] Phase 2 進入 admin 區時確認 dark navy 處理方式
- [ ] Phase 2 進入 google-button 區時搬服務色到 `lib/constants/brand-colors.ts`
