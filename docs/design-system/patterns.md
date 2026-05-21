# Patterns

> 「常用 UI 組合」的 cheatsheet。每個 pattern 都用 token + variant 寫成，**不要自己拼 className**。

---

## 1. 頁面標頭（詳情頁）

返回鍵 + 標題 + 動作按鈕。

```tsx
<div className="flex items-start gap-3">
  <Button variant="ghost" size="icon" onClick={() => router.back()}>
    <ArrowLeft className="h-4 w-4" />
  </Button>
  <h1 className="t-h1 text-text-strong">新增連線公告</h1>
</div>
```

範例頁：`/dashboard/connections/new`、`/dashboard/listings/new`。

---

## 2. 頁面標頭（Dashboard）

問候 + 主 CTA。

```tsx
<div className="flex items-end justify-between mb-6">
  <div>
    <h1 className="t-h1 text-text-strong">嗨，yuki_tw 👋</h1>
    <p className="t-caption mt-1">今天有 3 筆新訂單需要處理</p>
  </div>
  <Button>＋ 新增連線</Button>
</div>
```

---

## 3. 卡片列表 row

```tsx
<Card variant="interactive" className="cursor-pointer">
  <CardContent className="flex items-center gap-3 p-4">
    <Avatar />
    <div className="flex-1 min-w-0">
      <div className="text-sm font-semibold text-text-strong truncate">標題</div>
      <div className="t-caption truncate">副標說明</div>
    </div>
    <Badge variant="success">已完成</Badge>
  </CardContent>
</Card>
```

---

## 4. 表單區段

```tsx
<div className="space-y-4">
  <div className="space-y-1.5">
    <Label htmlFor="title">
      標題 <span className="text-destructive">*</span>
    </Label>
    <Input id="title" placeholder="輸入標題" />
    <FormFieldError message={errors.title} />
  </div>
  ...
</div>
```

> 表單之間 `space-y-6`，欄位之間 `space-y-4`，Label↔Input `space-y-1.5`。

---

## 5. 空狀態

```tsx
<EmptyState
  icon={Package}
  title="找不到相符的商品"
  description="試試其他關鍵字或調整篩選條件"
/>
```

選用 CTA：傳 `action` prop。

---

## 6. 篩選面板

**桌機 sidebar / 行動裝置 Sheet** 雙層佈局。

```tsx
{/* Desktop sidebar */}
<aside className="hidden w-64 shrink-0 md:block">
  <FilterPanel />
</aside>

{/* Mobile sheet */}
<Sheet>
  <SheetTrigger render={<Button variant="outline-soft" size="icon-sm" />}>
    <SlidersHorizontal />
  </SheetTrigger>
  <SheetContent side="left" className="bg-surface-page border-border-soft">
    <FilterPanel />
  </SheetContent>
</Sheet>
```

FilterPanel 裡用 `FilterCheckbox` 帶 `color="var(--brand-500)"`。

---

## 7. Stats 卡片組

Dashboard 頂部數據區，含 highlight 樣式：

```tsx
<div className="grid grid-cols-4 gap-4">
  {/* Highlight 卡片：teal 底 */}
  <div className="bg-brand-500 text-cta-foreground rounded-2xl p-5">
    <div className="text-xs opacity-80">進行中連線</div>
    <div className="text-3xl font-bold mt-1">2</div>
  </div>

  {/* 一般 stat 卡片 */}
  <Card variant="elevated" className="p-5">
    <div className="t-caption">本月訂單</div>
    <div className="text-3xl font-bold text-text-strong mt-1">38</div>
    <div className="text-xs text-success font-semibold mt-1">+12% vs 上月</div>
  </Card>
</div>
```

---

## 8. 狀態 chip

訂單 / 連線生命週期用 Badge variants：

```tsx
<Badge variant="brand">代購中</Badge>      {/* 進行中 */}
<Badge variant="warning">收單中</Badge>    {/* 待處理 */}
<Badge variant="info">已出貨</Badge>       {/* 處理完 */}
<Badge variant="success">已完成</Badge>    {/* 結案 */}
<Badge variant="neutral">已取消</Badge>    {/* 中性結束 */}
<Badge variant="destructive">已退款</Badge> {/* 例外 */}
```

對應產品狀態的映射建議寫在 `lib/utils/format.ts` 的 `STATUS_BADGE_VARIANT` 之類的常數。

---

## 9. 詳情頁雙欄佈局

左主內容 + 右 sticky CTA card：

```tsx
<div className="grid grid-cols-[1fr_360px] gap-6 max-md:grid-cols-1">
  <div>
    <ImageGallery />
    <Card variant="elevated">...</Card>
  </div>
  <div>
    <Card variant="elevated" className="sticky top-24 p-5">
      <div className="t-caption">商品定價</div>
      <div className="text-3xl font-bold text-text-strong">¥ 18,500</div>
      <Button className="w-full mt-4">立即下訂</Button>
      <Button variant="outline-soft" className="w-full mt-2">加入心願單</Button>
    </Card>
  </div>
</div>
```

---

## 10. Modal 確認對話

刪除 / 重要操作的二次確認。

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button variant="destructive">刪除</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogTitle>確認刪除？</DialogTitle>
    <DialogDescription className="t-caption">
      此操作無法復原。
    </DialogDescription>
    <DialogFooter className="gap-2">
      <Button variant="ghost">取消</Button>
      <Button variant="destructive">確認刪除</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

> 注意：`destructive` variant 是「紅線框 → hover 填滿亮淺紅 + 白字」（同 `cta-outline` 家族）。
> 用 `ghost` 而非 `outline-soft` 當「取消」，讓視覺層級更清楚（取消是中性 / 弱化動作）。
> 完整 spec 見 [`docs/superpowers/specs/2026-05-21-button-design.md`](../superpowers/specs/2026-05-21-button-design.md)。

---

## 加新 pattern 流程

1. 至少在兩處重複使用，才值得進這份文件
2. 確認所有 className 都用 token / variant，沒有硬碼 hex
3. 寫成最小 JSX 範例，標記範例頁路徑
4. 連回相關元件（[components.md](./components.md)）
