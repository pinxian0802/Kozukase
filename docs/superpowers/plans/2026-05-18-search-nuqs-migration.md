# /search 改用 nuqs 遷移計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `/search` 頁的篩選狀態從「手寫 useSearchParams + 樂觀本地鏡像 + 手動 isPending」改成由 nuqs 管理,從架構上消除「isPending 漏綁某篩選導致無限 loading」這類 bug,行為與現況完全一致。

**Architecture:** 引入 nuqs(URL 即 state 函式庫)+ `<NuqsAdapter>`。`/search` 的 `q/category/brand/tab/page/pageSize` 改用 `useQueryState`/`useQueryStates`,刪除 `localTab/localCategory/localBrandId` 三個鏡像 state、三個同步 effect、reset effect 與手寫 `isPending`;loading 改由 nuqs 的 `startTransition`(React `useTransition`)+ react-query 既有 `isFetching` 提供。範圍**只限 `/search`**,不動 `/connections`、`/products/[id]`。

**Tech Stack:** Next.js 16 / React 19 / nuqs v2 / @tanstack/react-query (tRPC) / Playwright E2E

**已知現況(實作前提,已驗證):**
- `nuqs` 尚未安裝;無 `<NuqsAdapter>`。
- 測試基礎建設只有 Playwright E2E(`tests/*.spec.ts`,`import { test, expect } from '@playwright/test'`,seed 用 `tests/helpers/db` 的 `seedActiveListing`)。無 vitest/jest/RTL。
- `app/(buyer)/search/page.tsx` 的 `clearAllFilters`(現 134-142 行)**沒有任何呼叫點**(死碼)→ 遷移時直接刪除,不移植。
- `trpc.product.browse.useQuery` 解構的 `isLoading`(現 69 行)**未被使用**(死變數)→ 遷移時一併移除。
- 本專案 `Is a git repository: false`,且使用者偏好不主動 commit → 本計畫以「型別檢查 + lint + E2E 綠燈」作為每個 task 的完成閘門,不含 git commit 步驟。
- `category`/`brand` 在 nuqs 用 `parseAsString` 回傳 `string | null`(現況是 `string | undefined`)→ 傳入 tRPC query 時統一 `?? undefined` 轉換。

---

## File Structure

| 檔案 | 動作 | 責任 |
|------|------|------|
| `package.json` | 修改 | 新增 `nuqs` 相依 |
| `app/layout.tsx` | 修改 | 在 provider 樹外層包 `<NuqsAdapter>`,讓全站可用 nuqs hooks |
| `tests/search-nuqs.spec.ts` | 建立 | `/search` 行為特徵化(characterization)E2E:鎖定「篩選不卡 loading」「URL 雙向同步」「外部連結帶參數」「瀏覽器返回」四項——**遷移前在現有程式碼上必須先綠燈**,當作重構安全網 |
| `app/(buyer)/search/page.tsx` | 修改 | 篩選狀態改用 nuqs;刪除鏡像 state / 同步 effect / reset effect / 手寫 isPending / 死碼 clearAllFilters / 死變數 isLoading |

每個 task 結束時整個專案 `npx tsc --noEmit` 必須 0 錯誤(不可留中間不可編譯狀態)。Task 3 是單檔原子重構,不可拆成「刪 state」「改 JSX」兩個會編譯失敗的中間步驟。

---

## Task 1: 安裝 nuqs 並掛上 NuqsAdapter

**Files:**
- Modify: `package.json`(由 npm install 自動更新)
- Modify: `app/layout.tsx:44-61`

- [ ] **Step 1: 安裝 nuqs**

Run:
```bash
cd /Users/ting/Desktop/kozukase/Kozukase && npm install nuqs
```
Expected: `package.json` 的 `dependencies` 出現 `"nuqs": "^2..."`,安裝無 peer dependency 錯誤(nuqs v2 支援 Next 16 / React 19)。

- [ ] **Step 2: 確認版本已寫入**

Run:
```bash
node -p "require('./package.json').dependencies.nuqs"
```
Expected: 印出版本字串(例如 `^2.4.3`),不是 `undefined`。

- [ ] **Step 3: 在 root layout 包入 NuqsAdapter**

修改 `app/layout.tsx`。在 import 區(第 8 行 `import NextTopLoader ...` 之後)新增:

```tsx
import { NuqsAdapter } from "nuqs/adapters/next/app";
```

然後把 `<body>` 內的 provider 樹用 `<NuqsAdapter>` 包起來。將現有:

```tsx
      <body className="min-h-full flex flex-col">
        <NextTopLoader color="#0a0a0a" height={2} showSpinner={false} />
        <TooltipProvider>
          <TRPCProvider>
            <SessionProvider value={session}>
              {children}
              <Toaster position="top-center" />
            </SessionProvider>
          </TRPCProvider>
        </TooltipProvider>
      </body>
```

改為:

```tsx
      <body className="min-h-full flex flex-col">
        <NextTopLoader color="#0a0a0a" height={2} showSpinner={false} />
        <NuqsAdapter>
          <TooltipProvider>
            <TRPCProvider>
              <SessionProvider value={session}>
                {children}
                <Toaster position="top-center" />
              </SessionProvider>
            </TRPCProvider>
          </TooltipProvider>
        </NuqsAdapter>
      </body>
```

- [ ] **Step 4: 型別檢查**

Run:
```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS"
```
Expected: `0`

- [ ] **Step 5: 確認 dev server 可啟動(NuqsAdapter 掛載無誤)**

Run:
```bash
timeout 40 npm run dev > /tmp/nuqs_dev.log 2>&1 & sleep 30; grep -iE "ready|compiled|error" /tmp/nuqs_dev.log | tail -5; pkill -f "next dev" || true
```
Expected: log 出現 ready/compiled,且**沒有** NuqsAdapter 相關 runtime 錯誤。

---

## Task 2: 建立 /search 行為特徵化 E2E(重構安全網)

**Files:**
- Create: `tests/search-nuqs.spec.ts`

此 spec 必須在「**尚未遷移的現有程式碼**」上就綠燈,作為 Task 3 重構的對照基準。鎖定的行為即先前修掉的 bug 與 nuqs 必須保留的 URL 語意。

- [ ] **Step 1: 寫特徵化測試**

Create `tests/search-nuqs.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { seedActiveListing, dbAdmin } from './helpers/db'

let seed: Awaited<ReturnType<typeof seedActiveListing>>

test.beforeAll(async () => {
  seed = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
})
test.afterAll(async () => {
  await dbAdmin().from('products').delete().eq('id', seed.productId)
})

test.describe('/search 行為特徵化（nuqs 遷移前後皆須綠燈）', () => {
  // 回歸先前修掉的「篩選後卡片區無限 loading」bug：
  // 進入結果頁 → 點分類篩選 → 骨架必須在時限內消失，並出現結果或空狀態。
  test('點選分類篩選後不會卡在 loading', async ({ page }) => {
    await page.goto(`/search?tab=products&q=${encodeURIComponent(seed.productName)}`)
    await expect(page.getByText(seed.productName).first()).toBeVisible({ timeout: 20000 })

    // 展開更多分類並點「其他」（seed 商品 category = 'other'）
    await page.getByRole('button', { name: '查看更多分類' }).click()
    await page.getByText('其他', { exact: true }).click()

    // 關鍵斷言：骨架必須消失（bug 時會永遠存在）
    await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0, { timeout: 20000 })
    // 且結果區進入穩定狀態：出現商品卡或空狀態其一
    await expect(
      page.getByText(seed.productName).first()
        .or(page.getByText('找不到相符的商品'))
    ).toBeVisible({ timeout: 20000 })
    // 篩選已寫入 URL
    await expect(page).toHaveURL(/[?&]category=other\b/)
  })

  test('URL 帶 category 直接進入能正確篩選且不卡 loading', async ({ page }) => {
    await page.goto(`/search?tab=products&category=other&q=${encodeURIComponent(seed.productName)}`)
    await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0, { timeout: 20000 })
    await expect(page.getByText(seed.productName).first()).toBeVisible({ timeout: 20000 })
  })

  test('切換 tab 會更新 URL 且 page 重設為 1', async ({ page }) => {
    await page.goto(`/search?tab=products&page=2`)
    await page.getByRole('button', { name: '代購' }).click()
    await expect(page).toHaveURL(/[?&]tab=listings\b/)
    await expect(page).not.toHaveURL(/[?&]page=2\b/)
  })

  test('瀏覽器返回鍵能回到前一個篩選狀態', async ({ page }) => {
    await page.goto(`/search?tab=products`)
    await page.getByRole('button', { name: '查看更多分類' }).click()
    await page.getByText('其他', { exact: true }).click()
    await expect(page).toHaveURL(/[?&]category=other\b/)
    await page.goBack()
    await expect(page).not.toHaveURL(/[?&]category=other\b/)
  })
})
```

- [ ] **Step 2: 在現有(未遷移)程式碼上跑,確認全綠**

Run:
```bash
npx playwright test tests/search-nuqs.spec.ts --project=chromium-buyer 2>&1 | tail -20
```
Expected: 4 passed。
(若 project 名稱不符,先 `npx playwright test --list tests/search-nuqs.spec.ts` 查實際 project 名,使用買家已登入態的 project。)

- [ ] **Step 3: 確認 lint 通過**

Run:
```bash
npm run lint 2>&1 | tail -5
```
Expected: 無新錯誤。

---

## Task 3: 將 /search 篩選狀態原子遷移到 nuqs

**Files:**
- Modify: `app/(buyer)/search/page.tsx`(現 1-149 行的 import 與狀態/函式區整段重寫;150 行之後的 JSX 做指定字串替換)

> 單檔原子重構:以下 Step 1–6 必須在同一輪完成後才跑 Step 7 型別檢查;中間狀態不保證可編譯,屬正常。

- [ ] **Step 1: 重寫 import 區(第 1–18 行)**

將現有第 1–18 行:

```tsx
'use client'

import { Suspense, useState, useEffect, type ReactNode } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'
import { FilterCheckbox } from '@/components/ui/filter-checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductCard } from '@/components/product/product-card'
import { ListingComparison } from '@/components/product/listing-comparison'
import { EmptyState } from '@/components/shared/empty-state'
import { Pagination } from '@/components/ui/pagination'
import type { ProductCategory } from '@/lib/validators/product'
import { trpc } from '@/lib/trpc/client'
import { PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'
import { Package } from 'lucide-react'
```

替換為:

```tsx
'use client'

import { Suspense, useState, useTransition, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQueryState, useQueryStates, parseAsString, parseAsInteger, parseAsStringEnum } from 'nuqs'
import { SlidersHorizontal, X } from 'lucide-react'
import { FilterCheckbox } from '@/components/ui/filter-checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductCard } from '@/components/product/product-card'
import { ListingComparison } from '@/components/product/listing-comparison'
import { EmptyState } from '@/components/shared/empty-state'
import { Pagination } from '@/components/ui/pagination'
import type { ProductCategory } from '@/lib/validators/product'
import { trpc } from '@/lib/trpc/client'
import { PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'
import { Package } from 'lucide-react'
```

(差異:`useEffect`→`useTransition`;移除 `useRouter`;`next/navigation` 只留 `useSearchParams`;新增 nuqs import。`useState` 保留——`categoryExpanded` 仍需要。)

- [ ] **Step 2: 重寫狀態與查詢區(現第 39–111 行)**

將現有第 39–111 行(`function SearchContent() {` 起,至 listing query 後的 reset effect 止)整段:

```tsx
function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const q = searchParams.get('q') ?? ''
  const category = searchParams.get('category') ?? undefined
  const brandId = searchParams.get('brand') ?? undefined
  const tab = (searchParams.get('tab') ?? 'listings') as 'products' | 'listings'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = (() => {
    const raw = parseInt(searchParams.get('pageSize') ?? '20', 10)
    return [10, 20, 50].includes(raw) ? raw : 20
  })()

  const [categoryExpanded, setCategoryExpanded] = useState(false)
  const [isPending, setIsPending] = useState(false)
  // Optimistic local state — updates immediately on click; syncs back when URL commits
  const [localTab, setLocalTab] = useState(tab)
  const [localCategory, setLocalCategory] = useState<string | undefined>(category)
  const [localBrandId, setLocalBrandId] = useState<string | undefined>(brandId)
  useEffect(() => { setLocalTab(tab) }, [tab])
  useEffect(() => { setLocalCategory(category) }, [category])
  useEffect(() => { setLocalBrandId(brandId) }, [brandId])

  const { data: brandsData } = trpc.brand.forSearch.useQuery({
    query: q || undefined,
    category: category as ProductCategory | undefined,
  })
  const brands = brandsData ?? []

  const { data, isLoading, isFetching } = trpc.product.browse.useQuery(
    {
      query: q || undefined,
      category: category as ProductCategory | undefined,
      brandId,
      page,
      limit: pageSize,
    },
    {
      enabled: tab === 'products',
      placeholderData: (prev) => prev,
    }
  )

  const products = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 0

  const {
    data: listingData,
    isFetching: listingFetching,
  } = trpc.listing.browse.useQuery(
    {
      query: q || undefined,
      category: category as ProductCategory | undefined,
      brandId,
      page,
      limit: pageSize,
    },
    {
      enabled: tab === 'listings',
      placeholderData: (prev) => prev,
    }
  )

  const listings = listingData?.items ?? []
  const listingTotal = listingData?.total ?? 0
  const listingTotalPages = listingData?.totalPages ?? 0
  // Clear the optimistic pending state as soon as the URL params commit;
  // react-query's isFetching takes over the loading display from there.
  useEffect(() => {
    setIsPending(false)
  }, [tab, category, brandId, page, pageSize])
```

整段替換為:

```tsx
function SearchContent() {
  // useSearchParams 僅用於商品卡「返回搜尋」連結的 from= 序列化（唯讀）
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // q 由站外搜尋框帶入，本頁唯讀
  const [q] = useQueryState('q', parseAsString.withDefault(''))

  // 一組會一起變動的篩選參數；history:'push' 讓瀏覽器上一頁可回到前一組篩選，
  // scroll:false 對齊原本 router.push 的行為（分頁時另行手動捲動）。
  const [{ category, brand: brandId, tab, page, pageSize }, setParams] = useQueryStates(
    {
      category: parseAsString,
      brand: parseAsString,
      tab: parseAsStringEnum(['listings', 'products'] as const).withDefault('listings'),
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsInteger.withDefault(20),
    },
    { history: 'push', scroll: false, shallow: true, startTransition }
  )

  // 保留原有的輸入夾擠/白名單防呆
  const safePage = Math.max(1, page)
  const safePageSize = [10, 20, 50].includes(pageSize) ? pageSize : 20
  const categoryArg = (category ?? undefined) as ProductCategory | undefined
  const brandArg = brandId ?? undefined

  const [categoryExpanded, setCategoryExpanded] = useState(false)

  const { data: brandsData } = trpc.brand.forSearch.useQuery({
    query: q || undefined,
    category: categoryArg,
  })
  const brands = brandsData ?? []

  const { data, isFetching } = trpc.product.browse.useQuery(
    {
      query: q || undefined,
      category: categoryArg,
      brandId: brandArg,
      page: safePage,
      limit: safePageSize,
    },
    {
      enabled: tab === 'products',
      placeholderData: (prev) => prev,
    }
  )

  const products = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 0

  const {
    data: listingData,
    isFetching: listingFetching,
  } = trpc.listing.browse.useQuery(
    {
      query: q || undefined,
      category: categoryArg,
      brandId: brandArg,
      page: safePage,
      limit: safePageSize,
    },
    {
      enabled: tab === 'listings',
      placeholderData: (prev) => prev,
    }
  )

  const listings = listingData?.items ?? []
  const listingTotal = listingData?.total ?? 0
  const listingTotalPages = listingData?.totalPages ?? 0
```

(重點:刪除 `useRouter`、手寫 URL 解析、`localTab/localCategory/localBrandId` 三個鏡像 state、三個同步 effect、reset effect、手寫 `isPending` state、未使用的 `isLoading`。`isPending` 改由 `useTransition` 提供;nuqs 回傳值即時更新,query key 立即改變,`isFetching` 接手骨架顯示。)

- [ ] **Step 3: 重寫四個函式(現第 113–149 行)→ 三個**

將現有第 113–149 行:

```tsx
  const updateTab = (newTab: 'products' | 'listings') => {
    if (newTab === localTab) return
    setLocalTab(newTab)
    setIsPending(true)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', newTab)
    params.set('page', '1')
    router.push(`/search?${params.toString()}`, { scroll: false })
  }

  const updateParam = (key: string, value: string | null) => {
    setIsPending(true)
    if (key === 'category') setLocalCategory(value ?? undefined)
    if (key === 'brand') setLocalBrandId(value ?? undefined)
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.set('page', '1')
    router.push(`/search?${params.toString()}`, { scroll: false })
  }

  const clearAllFilters = () => {
    setIsPending(true)
    setLocalCategory(undefined)
    setLocalBrandId(undefined)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    params.set('pageSize', String(pageSize))
    router.push(`/search?${params.toString()}`, { scroll: false })
  }

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(newPage))
    router.push(`/search?${params.toString()}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
```

替換為(移除死碼 `clearAllFilters`;`updateParam` 限縮 key 型別):

```tsx
  const updateTab = (newTab: 'products' | 'listings') => {
    if (newTab === tab) return
    setParams({ tab: newTab, page: 1 })
  }

  const updateParam = (key: 'category' | 'brand' | 'pageSize', value: string | null) => {
    if (key === 'pageSize') {
      setParams({ pageSize: value ? parseInt(value, 10) : 20, page: 1 })
      return
    }
    setParams({ [key]: value, page: 1 })
  }

  const handlePageChange = (newPage: number) => {
    setParams({ page: newPage })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
```

(說明:原 `clearAllFilters` 無呼叫點,屬死碼,依 YAGNI 不移植。`updateParam('pageSize', v)` 行為對齊原本「改每頁筆數並回第 1 頁」;`tab` enum 等於預設 `listings` 時 nuqs 會自動從 URL 移除該參數,與原本不寫 tab 即視為 listings 的行為一致。)

- [ ] **Step 4: JSX 內 `localCategory`/`localBrandId`/`localTab` 改為 nuqs 值**

在第 150 行之後的 JSX 中做以下精確替換(每處字串在檔案中唯一):

1. `if (localCategory) {` → `if (category) {`
2. `label: PRODUCT_CATEGORY_LABELS[localCategory as ProductCategory] ?? localCategory,` → `label: PRODUCT_CATEGORY_LABELS[category as ProductCategory] ?? category,`
3. `if (localBrandId) {` → `if (brandId) {`
4. `const brandName = brands.find((b) => b.id === localBrandId)?.name ?? localBrandId` → `const brandName = brands.find((b) => b.id === brandId)?.name ?? brandId`
5. `checked={localCategory === key}`(出現 2 次,firstHalf 與 secondHalf)→ 用全部取代為 `checked={category === key}`
6. `onClick={() => updateParam('category', localCategory === key ? null : key)}`(出現 2 次)→ 全部取代為 `onClick={() => updateParam('category', category === key ? null : key)}`
7. `checked={localBrandId === brand.id}` → `checked={brandId === brand.id}`
8. `onClick={() => updateParam('brand', localBrandId === brand.id ? null : brand.id)}` → `onClick={() => updateParam('brand', brandId === brand.id ? null : brand.id)}`
9. `{localTab === 'products'`(標題列那處)→ `{tab === 'products'`
10. `value={String(pageSize)}` 維持不變(`pageSize` 名稱沿用);其 `onValueChange={(v) => updateParam('pageSize', v)}` 維持不變
11. `localTab === t`(tab bar)→ `tab === t`
12. `{localTab === 'products' ? (`(結果區切換那處)→ `{tab === 'products' ? (`

注意第 5、6 點各有兩處(firstHalf / secondHalf 兩個 `FilterCheckbox`),用 Edit 的 `replace_all: true` 一次處理。第 9 與第 12 點皆為 `localTab === 'products'`,但前者後接換行字串、後者後接 ` ? (`,屬不同唯一字串,分別替換。

- [ ] **Step 5: `from=` 連結確認(現第 360 行)**

第 360 行 `href={`/products/${product.id}?from=${encodeURIComponent(`/search?${searchParams.toString()}`)}`}` **維持不變**。`useSearchParams()` 已於 Step 2 保留,僅供此唯讀序列化使用,nuqs 與 useSearchParams 可共存。

- [ ] **Step 6: loading 條件確認(現第 343、379 行)**

第 343 行 `(isPending || isFetching) ? (` 與第 379 行 `(isPending || listingFetching) ? (` **維持不變**。`isPending` 現在來自 `useTransition`(由 nuqs `startTransition` 驅動),語意等價且更精確。

- [ ] **Step 7: 型別檢查(全專案)**

Run:
```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "search/page|error TS" | head -20; echo "count:"; npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS"
```
Expected: `search/page` 無錯誤;`count:` 為 `0`。

- [ ] **Step 8: lint**

Run:
```bash
npm run lint 2>&1 | tail -5
```
Expected: 無新錯誤(特別確認無 `localTab/localCategory/localBrandId/useEffect/useRouter/isLoading` 之 unused 殘留)。

---

## Task 4: 行為等價驗收與收尾

**Files:** 無(僅執行驗證)

- [ ] **Step 1: 特徵化 E2E 在遷移後仍全綠**

Run:
```bash
npx playwright test tests/search-nuqs.spec.ts --project=chromium-buyer 2>&1 | tail -20
```
Expected: 4 passed(與 Task 2 Step 2 相同結果——重構未改變行為)。

- [ ] **Step 2: 既有買家 E2E 未退化**

Run:
```bash
npx playwright test tests/buyer.spec.ts --project=chromium-buyer 2>&1 | tail -20
```
Expected: 全綠(`可搜尋到 seed 商品` 等與 /search 相關案例不得退化)。

- [ ] **Step 3: 手動行為對照清單(逐項勾選)**

`npm run dev` 後手動確認下列與遷移前一致:

- [ ] 進 `/search` 預設在「代購」tab(`tab` 預設 listings)
- [ ] 點分類 checkbox:立即打勾、骨架出現後正常顯示結果(不卡 loading)
- [ ] 點品牌 checkbox:同上
- [ ] 改每頁筆數(10/20/50):結果更新且回第 1 頁
- [ ] 切換 商品 / 代購 tab:結果切換且回第 1 頁
- [ ] 分頁切換:換頁且自動捲到頂端
- [ ] 移除 active filter chip(右上 X):對應篩選清除
- [ ] 直接以 `?category=...&brand=...&page=2&pageSize=50&tab=products` 進站:UI 狀態與 URL 一致
- [ ] 瀏覽器上一頁/下一頁:回到對應的篩選狀態
- [ ] 點商品卡進詳情頁,返回時 `from=` 連結可回到原搜尋

- [ ] **Step 4: 更新平台文件(專案慣例)**

依使用者長期偏好,流程/架構變更需更新 `docs/platform-overview.md`。在其中 `/search` 相關段落補一句:`/search` 篩選狀態由 nuqs 管理(URL 即 state),取代原手寫 useSearchParams + 樂觀鏡像。
Run:
```bash
grep -n "search\|nuqs\|篩選" docs/platform-overview.md | head
```
Expected: 找到 /search 相關段落位置;補上該句後存檔。

- [ ] **Step 5: 收尾**

REQUIRED SUB-SKILL: 使用 superpowers:finishing-a-development-branch 決定整合方式。
注意:本專案非 git repo 且使用者偏好不主動 commit → 收尾以「驗證結果彙整 + 待使用者指示」為主,不自動 commit。

---

## Self-Review

**1. Spec 覆蓋:**
- 「消除 isPending 漏綁類 bug」→ Task 3 刪除手寫 isPending/鏡像/reset effect,改 nuqs+useTransition ✓
- 「行為與現況一致」→ Task 2 特徵化 E2E(遷移前後同綠)+ Task 4 手動清單 ✓
- 「範圍只限 /search」→ File Structure 明列僅 4 檔,未含 connections/products ✓
- 「Provider 前置」→ Task 1 ✓
- 輸入防呆(page 夾擠、pageSize 白名單、category null→undefined)→ Task 3 Step 2 `safePage/safePageSize/categoryArg` ✓
- `from=` 返回連結不破 → Task 3 Step 5 保留 useSearchParams ✓

**2. Placeholder 掃描:** 無 TBD/TODO;所有程式碼步驟均給完整前後字串與指令、預期輸出。

**3. 型別一致性:** `setParams` 於 Task 3 Step 2 定義(useQueryStates),Step 3 一致使用;`updateParam` key 型別 `'category'|'brand'|'pageSize'` 與 JSX(Step 4 第 6/8/10 點)呼叫一致;`category/brandId/tab/page/pageSize` 名稱在 query、函式、JSX 全程一致;`isPending` 由 `useTransition` 提供,Step 6 沿用名稱一致。

---

## Execution Handoff

(由主流程在計畫存檔後向使用者提出執行方式選擇。)
