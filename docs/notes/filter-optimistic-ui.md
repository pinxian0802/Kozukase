# 篩選 UI 即時反應模式

## 問題描述

在 `/search`、`/connections`、`/products/[id]` 頁面，點擊左側篩選條件後有明顯延遲感：

- 篩選 pill 不會馬上出現在 header 區塊
- 卡片區塊不會立刻進入 loading 狀態
- 使用者點擊後看不到任何反應，體驗不佳

---

## 根本原因

### `/search` 和 `/connections`（有網路請求）

篩選狀態改變後，React 重新 render，tRPC 發出新的 query。問題在於 `isFetching` 不會在「點擊的那個 render」立刻變成 `true`，會晚一兩個 render 才反應。這段空窗期內：

- 舊卡片還在顯示
- 沒有任何 loading 指示
- 如果 pill 依賴 URL params（`/search`），也要等 `router.push` 完成才更新

### `/products/[id]`（client-side 篩選）

原本使用 `useTransition`，這會 **defer** state 更新。React 刻意延遲讓畫面先不改變，導致 pill（依賴被 defer 的 state）也跟著延遲出現。

---

## 解法

### `/search` 和 `/connections`：加 `isPending` state

```tsx
const [isPending, setIsPending] = useState(false)

// 資料回來時重設
useEffect(() => { setIsPending(false) }, [data])

// 點擊任何篩選時立刻設為 true
const handleFilter = (value) => {
  setIsPending(true)   // ← 立刻觸發 skeleton
  setFilterState(value)
}

// loading 條件加入 isPending
const showLoading = isPending || isFetching || isLoading
```

**`/search` 特別處理**：篩選 pill 用 `localCategory` / `localBrandId` 做 optimistic display（不等 URL 更新），`updateParam` 裡同時設 `setIsPending(true)`。

**`/connections` 特別處理**：篩選 state 本來就是 local state，pill 已經即時；只需補上 `setIsPending(true)` 讓 skeleton 也同步。

### `/products/[id]`：移除 `useTransition`

這個頁面的篩選是純 client-side（過濾已載入的陣列），沒有網路請求：

```tsx
// 之前（錯誤）
onCheckedChange={(checked) => startFilterTransition(() => setInStockOnly(checked))}

// 之後（正確）
onCheckedChange={setInStockOnly}
```

移除 `useTransition` 後，state 在點擊的當下立刻更新，pill 馬上出現，結果也在同一個 render 更新。不需要 skeleton，也不應該有 skeleton（因為沒有等待時間）。

---

## 各頁面對照表

| 頁面 | 篩選方式 | pill 即時方案 | loading 方案 |
|---|---|---|---|
| `/search` | URL params | `localCategory` / `localBrandId` local state | `isPending \|\| isFetching` |
| `/connections` | local state | 本來就即時 | `isPending \|\| isFetching \|\| isLoading` |
| `/products/[id]` | client-side filter | 移除 `useTransition`，直接 setState | 不需要（filtering 即時） |

---

## 注意事項

- `isPending` 的重設用 `useEffect(() => { setIsPending(false) }, [data])` 而不是監聽 `isFetching`，原因是 `isFetching` 的 timing 不穩定（點擊後第一個 render isFetching 可能還是 `false`，effect 就會提早重設）。
- client-side filtering 不適合加 skeleton，反而會造成 UI 閃爍（flicker）。
- `useTransition` 適合用在「渲染量大、需要避免 UI 卡頓」的場景，不適合用在「需要 pill 立刻反應」的篩選 UI。
