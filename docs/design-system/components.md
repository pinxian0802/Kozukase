# Components

> `components/ui/` 元件清單 + 可用 variants。需要新樣式時，請**加 variant**而不是寫 className 覆蓋。

---

## Button

`components/ui/button.tsx` — 基於 base-ui + cva。

### Variants
| Variant | 視覺 | 用途 |
|---|---|---|
| `default` | **實心 teal 底** | 主要 CTA（「立即下訂」「送出」「新增代購」等）|
| `outline` | 灰邊框、白底 | 中性次要動作（取消、瀏覽、跳過）|
| **`cta-outline`** | teal 線框 → hover 填滿 teal + 白字 | 品牌色次要 CTA（「新增連線」「查看更多」）|
| **`outline-soft`** | 米色邊框 | 中性的線框按鈕（收起分類等）|
| `secondary` | 淺灰底 | 第三層按鈕（少用）|
| `ghost` | 無邊無底 | 圖示按鈕、表格 inline 操作 |
| `destructive` | 紅線框 → hover 填滿亮淺紅 + 白字 | 刪除、退款；行為跟 `cta-outline` 同家族 |
| `link` | 文字底線 | 行內連結 |

### Sizes
`xs` (28px) / `sm` (32px) / `default` (36px) / `lg` (40px)；icon 對應 `icon-xs` / `icon-sm` / `icon` / `icon-lg`。

### Hover 行為（outline → fill 家族）

`cta-outline` 與 `destructive` 都是「線框 → hover 整顆填滿 + 白字」的家族，行為一致只差顏色。完整 spec 見 `docs/superpowers/specs/2026-05-21-button-design.md`。

### 範例
```tsx
<Button>立即下訂</Button>                       {/* default = 實心 teal 主 CTA */}
<Button variant="cta-outline">查看更多</Button>  {/* 次要 CTA */}
<Button variant="outline-soft" size="sm">取消</Button>
<Button variant="destructive">確認刪除</Button>
```

---

## Badge

`components/ui/badge.tsx` — 用於標籤、chip、狀態指示。

### Variants
| Variant | 視覺 | 用途 |
|---|---|---|
| `default` | 黑底白字 | 強標籤 |
| `secondary` | 淺灰底 | 一般標籤 |
| `outline` | 線框 | 中性標籤 |
| `ghost` | hover 才出底色 | 互動式標籤 |
| `destructive` | 紅 soft 底 | 錯誤、失效 |
| `link` | 文字 | 可點連結 |
| **`neutral`** | 米色底 | 一般 chip（active filter）|
| **`brand`** | teal soft 底 | 品牌色標籤 |
| **`success`** | 綠 soft 底 | 已完成、已通過 |
| **`warning`** | 橘 soft 底 | 待處理、即將逾期 |
| **`info`** | 藍 soft 底 | 處理中、資訊提示 |

### 範例
```tsx
<Badge variant="success">已完成</Badge>
<Badge variant="warning">即將逾期</Badge>
<Badge variant="brand">品牌標籤</Badge>
```

---

## Card

`components/ui/card.tsx`

### Variants
| Variant | 視覺 | 用途 |
|---|---|---|
| `default` | 微 ring | 一般卡片 |
| `elevated` | 軟陰影 + soft border | 強調卡片（title card、stats card）|
| `flat` | 只有邊框 | 列表 row、低層級 |
| `interactive` | hover 抬升 | 可點擊的卡片連結 |

### 子元件
- `CardHeader` / `CardTitle` / `CardDescription` / `CardAction`
- `CardContent` / `CardFooter`

### Size 修飾
`size="sm"` 縮短內距。

### 範例
```tsx
<Card variant="elevated">
  <CardHeader>
    <CardTitle>卡片標題</CardTitle>
    <CardDescription>說明文字</CardDescription>
  </CardHeader>
  <CardContent>內容</CardContent>
</Card>
```

---

## 其他 UI 元件（暫無 DS 修改）

| 元件 | 檔案 | 備註 |
|---|---|---|
| Avatar | `avatar.tsx` | shadcn 預設 |
| Breadcrumb | `breadcrumb.tsx` | shadcn 預設 |
| Calendar | `calendar.tsx` | shadcn 預設 |
| Checkbox | `checkbox.tsx` | shadcn 預設 |
| Command | `command.tsx` | shadcn 預設 |
| DatePicker | `date-picker.tsx` | 自製，已用 token |
| Dialog | `dialog.tsx` | shadcn 預設 |
| DropdownMenu | `dropdown-menu.tsx` | shadcn 預設 |
| **FilterCheckbox** | `filter-checkbox.tsx` | 自製，已遷移到 token（color prop 接 CSS var）|
| InputGroup | `input-group.tsx` | shadcn 預設 |
| Input | `input.tsx` | shadcn 預設 |
| Label | `label.tsx` | shadcn 預設 |
| MultiSelect | `multi-select.tsx` | 自製 |
| Pagination | `pagination.tsx` | shadcn 預設 |
| Popover | `popover.tsx` | shadcn 預設 |
| ScrollArea | `scroll-area.tsx` | shadcn 預設 |
| SearchableSelect | `searchable-select.tsx` | 自製 |
| Select | `select.tsx` | shadcn 預設 |
| Separator | `separator.tsx` | shadcn 預設 |
| Sheet | `sheet.tsx` | shadcn 預設 |
| Skeleton | `skeleton.tsx` | shadcn 預設 |
| Sonner | `sonner.tsx` | shadcn 預設（toast）|
| Switch | `switch.tsx` | shadcn 預設 |
| Table | `table.tsx` | shadcn 預設 |
| Tabs | `tabs.tsx` | shadcn 預設 |
| TagInput | `tag-input.tsx` | 自製 |
| Textarea | `textarea.tsx` | shadcn 預設 |
| Tooltip | `tooltip.tsx` | shadcn 預設 |

---

## 加新 variant 流程

1. 在元件的 `cva()` 加新項
2. 註冊到 `components.md`（這份文件）
3. 把 codebase 裡的同類 className 自製按鈕全換掉
4. 確認 grep 沒有殘留 `bg-[#...]` 等 arbitrary value

```tsx
// ❌ 這樣不對
<Button className="bg-brand-500 text-white hover:bg-brand-700">

// ✅ 應該是
<Button>
```
