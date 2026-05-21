# Tokens

> 所有 token 都在 [`app/globals.css`](../../app/globals.css) 定義。Tailwind utility 已透過 `@theme inline` 自動產生。

---

## 一、顏色

### 1.1 Raw scale（不直接用，當作 semantic 層的素材）

#### Brand teal
| Token | Class | oklch ≈ Hex |
|---|---|---|
| `--brand-50`  | `bg-brand-50`  | `oklch(0.97 0.02 195)` 極淺薄荷 |
| `--brand-100` | `bg-brand-100` | `oklch(0.93 0.05 195)` |
| `--brand-300` | `bg-brand-300` | `oklch(0.85 0.10 195)` |
| `--brand-500` | `bg-brand-500` | `oklch(0.74 0.12 195)` ≈ `#26C8C2`（主品牌色）|
| `--brand-700` | `bg-brand-700` | `oklch(0.55 0.10 195)` 深 teal |
| `--brand-900` | `bg-brand-900` | `oklch(0.35 0.06 195)` 深青 |

#### Neutral
| Token | Class | 視覺 |
|---|---|---|
| `--neutral-0`    | `bg-neutral-0`    | 純白 |
| `--neutral-50`   | `bg-neutral-50`   | 頁底冷白 |
| `--neutral-100`  | `bg-neutral-100`  | 極淺灰 |
| `--neutral-200`  | `bg-neutral-200`  | 淺灰（邊框）|
| `--neutral-300`  | `bg-neutral-300`  | 中淺灰（強邊框）|
| `--neutral-500`  | `bg-neutral-500`  | 中灰（placeholder）|
| `--neutral-600`  | `bg-neutral-600`  | 中深灰（次要文字）|
| `--neutral-900`  | `bg-neutral-900`  | 近黑（主文字）|
| `--neutral-1000` | `bg-neutral-1000` | 純黑 |

（中間階 200/400/700/800 同模式，依需要使用）

#### Status
| Token | Class | 用途 |
|---|---|---|
| `--success-500` / `--success-soft` / `--success-fg-soft` | `bg-success` / `bg-success-soft` | 成功 / 完成 |
| `--warning-500` / `--warning-soft` / `--warning-fg-soft` | `bg-warning` / `bg-warning-soft` | 警示 / 待處理 |
| `--info-500` / `--info-soft` / `--info-fg-soft` | `bg-info` / `bg-info-soft` | 資訊 / 處理中 |
| `--destructive` | `bg-destructive` / `text-destructive` | 錯誤 / 刪除 |

---

### 1.2 Semantic（**元件實際使用這層**）

#### Surface（背景）
| Token | Class | 用途 |
|---|---|---|
| `--surface-page`    | `bg-surface-page`    | 頁面底色 |
| `--surface-card`    | `bg-surface-card`    | 卡片底色 |
| `--surface-overlay` | `bg-surface-overlay` | Modal / Popover 底 |
| `--surface-muted`   | `bg-surface-muted`   | hover 底 / 區段底 / chip 底 |

#### Border
| Token | Class | 用途 |
|---|---|---|
| `--border-soft`   | `border-border-soft`   | 一般邊框 |
| `--border-strong` | `border-border-strong` | hover 邊框 / 強調分隔 |

#### Text
| Token | Class | 用途 |
|---|---|---|
| `--text-strong`  | `text-text-strong`  | 主文字（標題、內文重點）|
| `--text-muted`   | `text-text-muted`   | 次要文字（caption、subtitle）|
| `--text-faint`   | `text-text-faint`   | placeholder / 弱化文字 |
| `--text-inverse` | `text-text-inverse` | 深底白字 |

#### CTA & Brand
| Token | Class | 用途 |
|---|---|---|
| `--cta`              | `bg-cta`              | 主 CTA 按鈕底（teal）|
| `--cta-foreground`   | `text-cta-foreground` | CTA 文字（白）|
| `--brand`            | `bg-brand`            | 品牌色（同 `--brand-500`）|

---

### 1.3 Inline style 用法

JS 物件裡直接用 CSS var：

```tsx
<div style={{ background: 'var(--surface-card)', color: 'var(--text-strong)' }}>
```

---

## 二、Radius

繼承 shadcn 的 `--radius` 階梯：

| Token | Class | 值 |
|---|---|---|
| `--radius-sm` | `rounded-sm` | `0.225rem` |
| `--radius-md` | `rounded-md` | `0.3rem` |
| `--radius-lg` | `rounded-lg` | `0.375rem` |
| `--radius-xl` | `rounded-xl` | `0.525rem` |
| `--radius-2xl` | `rounded-2xl` | `0.675rem` |
| `--radius-3xl` | `rounded-3xl` | `0.825rem` |
| `--radius-4xl` | `rounded-4xl` | `0.975rem` |

巢狀圓角原則：**外圓角 = 內圓角 + 內外框間距**。

---

## 三、Spacing

沿用 Tailwind 4px 系統，但寫**用法準則**：

### 3.1 卡片內距
| 場景 | Class |
|---|---|
| 小卡片（chip、avatar）| `p-3` (12px) |
| 一般卡片 | `p-5` (20px) |
| 中型卡片（含 header） | `p-6` (24px) |
| 大卡片（表單頁主卡）| `p-8` (32px) |

### 3.2 區段垂直間距
| 場景 | Class |
|---|---|
| Title ↔ subtitle | `space-y-1` ~ `space-y-2` |
| 表單欄位之間 | `space-y-4` |
| Label ↔ Input | `space-y-1.5` |
| 區段內容塊 | `space-y-6` |
| 大區段分隔 | `space-y-10` ~ `space-y-12` |

### 3.3 Grid gap
| 場景 | Class |
|---|---|
| chip 列 | `gap-1.5` ~ `gap-2` |
| 產品卡網格 | `gap-4` |
| 雙欄佈局 | `gap-6` ~ `gap-8` |

---

## 四、Typography

定義在 `globals.css` `@layer components`。直接當 className 用。

| Class | 樣式 | 用途 |
|---|---|---|
| `t-display` | 40px / 1.1 / bold / heading font | 首頁 hero |
| `t-h1` | 30px / 1.2 / bold / heading font | 頁面標題 |
| `t-h2` | 24px / 1.35 / semibold | 區段標題 |
| `t-h3` | 18px / 1.4 / semibold | 卡片標題 |
| `t-body` | 14px / 1.65 | 正文 |
| `t-caption` | 12px / 1.5 / muted | 輔助說明 |
| `t-overline` | 11px / uppercase / faint | 小標 / 標籤 |

範例：
```tsx
<h1 className="t-h1">頁面標題</h1>
<p className="t-caption">這是說明文字</p>
```

---

## 五、Font family

| Token | Class | 用途 |
|---|---|---|
| `--font-sans` | `font-sans` | 預設無襯線（Inter）|
| `--font-mono` | `font-mono` | 等寬（程式碼、數字）|
| `--font-heading` | `font-heading` | 標題（Rubik，搭配 Noto Sans TC）|

中文後援字型在 `html` 元素上：PingFang TC → Noto Sans TC → Microsoft JhengHei → Heiti TC。

---

## 六、Shadow

目前無 token 化，使用 Tailwind 預設 + 偶爾 arbitrary value。常見：

```tsx
shadow-sm                                      // 微陰影
shadow-[0_1px_2px_rgba(0,0,0,0.07)]            // 細節陰影
shadow-[0_12px_40px_rgba(15,23,42,0.06)]       // 卡片浮起
```

> **TODO（未來）**：把這些抽成 `--shadow-{soft,card,overlay}` token。

---

## 七、Z-index

未 token 化。常見：
- 一般覆蓋：`z-10` ~ `z-30`
- Modal / Popover：`z-40` ~ `z-50`
- Toast：`z-50`
