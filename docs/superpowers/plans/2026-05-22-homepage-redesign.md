# 首頁重構 + 商品/連線瀏覽記錄 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) 把首頁改成「逛街型」版面(照片底主視覺 → 分類 → 熱門商品橫滑 → 即將出發的連線橫滑 → 成為賣家);(2) 為商品頁、連線頁補上瀏覽記錄,讓「熱門商品」用真實瀏覽數排序,並在賣家後台數據頁加上「商品瀏覽」「連線瀏覽」。

**Architecture:** 新增 `product_views` / `connection_views` 兩張表(比照既有 `listing_views`),在兩個詳情頁以 useEffect 記錄瀏覽。首頁改為 async Server Component,用 `createServerCaller()` 取「熱門商品」(`popular_products` RPC,依 `product_views` 排序、無資料以最新遞補)與「即將出發的連線」(`connection.browse`,日期排序),交給 client 元件 `SectionCarousel` 橫向滑動,沿用既有 `ProductCard` / `ConnectionCard`。任一排無資料則不渲染。

**Tech Stack:** Next.js 16(App Router, RSC)、tRPC v11、Supabase(Postgres RPC、service-role server client、RLS)、Tailwind v4(DS v1 tokens)、Playwright(E2E)。

**測試策略:** 本專案無單元測試框架,既有測試皆 Playwright E2E。後端/元件以型別、建置、E2E + 手動瀏覽器確認把關。瀏覽記錄與首頁各有一個 E2E;連線瀏覽記錄與後台新卡以手動確認。

**前置需求:** `.env.local` 具 `NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`E2E_SELLER_EMAIL`;可連 Supabase 套 migration。

---

## File Structure

**Create:**
- `supabase/migrations/00035_add_product_connection_views.sql` — `product_views`、`connection_views` 表 + 索引 + RLS。
- `supabase/migrations/00036_popular_products.sql` — `popular_products` RPC。
- `app/_home/home-hero.tsx` — 主視覺搜尋區(Server Component)。
- `app/_home/section-carousel.tsx` — 橫向滑動區塊(Client Component)。

**Modify:**
- `server/routers/analytics.ts` — 新增 `recordProductView`、`recordConnectionView`;`getSellerStats` 追加兩指標。
- `server/routers/product.ts` — 新增 `popular` procedure。
- `app/(buyer)/products/[id]/page-client.tsx` — 加瀏覽記錄 useEffect。
- `app/(buyer)/connections/[id]/page.tsx` — 加瀏覽記錄 useEffect。
- `components/seller/analytics-stats.tsx` — 新增兩張 StatCard,skeleton 8→10。
- `app/page.tsx` — 重建首頁版面。
- `tests/buyer.spec.ts` — 新增「商品頁記錄瀏覽」與「首頁區塊」E2E。

**Reuse(不改):** `app/home-search-bar.tsx`、`components/product/product-card.tsx`、`components/connection/connection-card.tsx`、`components/layout/{header,footer}.tsx`、`lib/trpc/server.ts`。

---

## Task 1: Migration A — 新增 `product_views` / `connection_views` 表

**Files:**
- Create: `supabase/migrations/00035_add_product_connection_views.sql`

比照 `listing_views`(migration 00032)。RLS 僅影響非 service-role 直連;app 端以 service-role 寫入/讀取,故 record 與後台統計不受 RLS 阻擋。

- [ ] **Step 1: 建立 migration 檔**

寫入 `supabase/migrations/00035_add_product_connection_views.sql`:

```sql
-- Migration 00035: 商品頁 / 連線頁瀏覽記錄(比照 listing_views）

-- product_views：記錄商品頁瀏覽
CREATE TABLE product_views (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  viewer_id   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  viewed_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_views_product_id ON product_views(product_id);
CREATE INDEX idx_product_views_viewed_at  ON product_views(viewed_at);
ALTER TABLE product_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_views_insert"
  ON product_views FOR INSERT
  WITH CHECK (viewer_id IS NULL OR viewer_id = auth.uid());
-- 商品無單一擁有者:在此商品有刊登的賣家可看
CREATE POLICY "product_views_select_seller"
  ON product_views FOR SELECT
  TO authenticated
  USING (
    product_id IN (SELECT product_id FROM listings WHERE seller_id = auth.uid())
  );

-- connection_views：記錄連線頁瀏覽
CREATE TABLE connection_views (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id  uuid        NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  viewer_id      uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  viewed_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_connection_views_connection_id ON connection_views(connection_id);
CREATE INDEX idx_connection_views_viewed_at     ON connection_views(viewed_at);
ALTER TABLE connection_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "connection_views_insert"
  ON connection_views FOR INSERT
  WITH CHECK (viewer_id IS NULL OR viewer_id = auth.uid());
CREATE POLICY "connection_views_select_seller"
  ON connection_views FOR SELECT
  TO authenticated
  USING (
    connection_id IN (SELECT id FROM connections WHERE seller_id = auth.uid())
  );
```

- [ ] **Step 2: 套用 migration**

擇一:`npx supabase db push`,或 Supabase MCP `apply_migration`(name `add_product_connection_views`,query 為上面 SQL)。

- [ ] **Step 3: 驗證表存在**

執行:`SELECT count(*) FROM product_views; SELECT count(*) FROM connection_views;`
Expected:各回傳 0(或現有筆數),不報錯。

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00035_add_product_connection_views.sql
git commit -m "feat(db): add product_views and connection_views tables"
```

---

## Task 2: Migration B — `popular_products` RPC

**Files:**
- Create: `supabase/migrations/00036_popular_products.sql`

依近 N 天 `product_views` 筆數排序;無瀏覽者(數=0)以 `created_at DESC` 遞補。只回傳「至少有一個 active 刊登」的商品。回傳形狀對齊 `ProductCardProduct`。

- [ ] **Step 1: 建立 migration 檔**

寫入 `supabase/migrations/00036_popular_products.sql`:

```sql
-- Migration 00036: popular_products RPC（首頁「熱門商品」用）
CREATE OR REPLACE FUNCTION public.popular_products(
  result_limit integer DEFAULT 12,
  days_window  integer DEFAULT 90
)
RETURNS TABLE (
  id                uuid,
  name              text,
  brand             text,
  category          text,
  model_number      text,
  catalog_image_url text,
  wish_count        integer,
  view_count        bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id,
    p.name,
    b.name AS brand,
    p.category::text,
    p.model_number,
    COALESCE(catalog_img.url, fallback_img.url) AS catalog_image_url,
    p.wish_count,
    COALESCE(v.view_count, 0) AS view_count
  FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN product_images catalog_img ON catalog_img.id = p.catalog_image_id
  LEFT JOIN LATERAL (
    SELECT img2.url
    FROM product_images img2
    WHERE img2.product_id = p.id
    ORDER BY img2.created_at ASC, img2.id ASC
    LIMIT 1
  ) fallback_img ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::bigint AS view_count
    FROM product_views pv
    WHERE pv.product_id = p.id
      AND pv.viewed_at >= now() - make_interval(days => days_window)
  ) v ON TRUE
  WHERE p.is_removed = false
    AND EXISTS (
      SELECT 1 FROM listings la
      WHERE la.product_id = p.id AND la.status = 'active'
    )
  ORDER BY COALESCE(v.view_count, 0) DESC, p.created_at DESC
  LIMIT result_limit;
$$;
```

- [ ] **Step 2: 套用 migration**(同 Task 1 Step 2 方式)

- [ ] **Step 3: 驗證可呼叫**

執行:`SELECT id, name, view_count FROM public.popular_products(5);`
Expected:回傳 ≤ 5 列、不報錯;無「含 active 刊登的商品」時回傳 0 列亦正常。

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00036_popular_products.sql
git commit -m "feat(db): add popular_products RPC"
```

---

## Task 3: analytics router — record procedures + 後台兩指標

**Files:**
- Modify: `server/routers/analytics.ts`

- [ ] **Step 1: 新增兩個 record procedures**

在 `recordProfileView` 的 procedure(其 `}),` 結尾)之後插入:

```ts
  recordProductView: publicProcedure
    .input(z.object({ product_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.from('product_views').insert({
        product_id: input.product_id,
        viewer_id: ctx.user?.id ?? null,
      })
    }),

  recordConnectionView: publicProcedure
    .input(z.object({ connection_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.from('connection_views').insert({
        connection_id: input.connection_id,
        viewer_id: ctx.user?.id ?? null,
      })
    }),
```

- [ ] **Step 2: 在 `getSellerStats` 取得賣家的連線 id 清單**

找到下列既有片段(計算 `productIds` 與 `sellerId`):

```ts
      const sellerId = ctx.user.id
```

在這一行**之後**插入:

```ts
      const { data: myConnections } = await ctx.db
        .from('connections')
        .select('id')
        .eq('seller_id', sellerId)
      const connectionIds = (myConnections ?? []).map((c: any) => c.id)
```

- [ ] **Step 3: 在解構陣列尾端加入四個變數**

把:

```ts
        wishMatchesCur, wishMatchesPrev,
      ] = await Promise.all([
```

改為:

```ts
        wishMatchesCur, wishMatchesPrev,
        productViewsCur, productViewsPrev,
        connectionViewsCur, connectionViewsPrev,
      ] = await Promise.all([
```

- [ ] **Step 4: 在 `Promise.all([...])` 陣列尾端加入四個查詢**

把 wishes 兩行與收尾:

```ts
        countInPeriod(ctx.db, 'wishes', [{ field: 'product_id', value: productIds }], 'created_at', curStart),
        countInPeriod(ctx.db, 'wishes', [{ field: 'product_id', value: productIds }], 'created_at', prevStart, curStart),
      ])
```

改為:

```ts
        countInPeriod(ctx.db, 'wishes', [{ field: 'product_id', value: productIds }], 'created_at', curStart),
        countInPeriod(ctx.db, 'wishes', [{ field: 'product_id', value: productIds }], 'created_at', prevStart, curStart),
        countInPeriod(ctx.db, 'product_views', [{ field: 'product_id', value: productIds }], 'viewed_at', curStart),
        countInPeriod(ctx.db, 'product_views', [{ field: 'product_id', value: productIds }], 'viewed_at', prevStart, curStart),
        countInPeriod(ctx.db, 'connection_views', [{ field: 'connection_id', value: connectionIds }], 'viewed_at', curStart),
        countInPeriod(ctx.db, 'connection_views', [{ field: 'connection_id', value: connectionIds }], 'viewed_at', prevStart, curStart),
      ])
```

- [ ] **Step 5: 在 return 物件加入兩個指標**

把:

```ts
        wishMatches:   { current: wishMatchesCur,   trend: calcTrend(wishMatchesCur,   wishMatchesPrev) },
      }
```

改為:

```ts
        wishMatches:   { current: wishMatchesCur,   trend: calcTrend(wishMatchesCur,   wishMatchesPrev) },
        productViews:    { current: productViewsCur,    trend: calcTrend(productViewsCur,    productViewsPrev) },
        connectionViews: { current: connectionViewsCur, trend: calcTrend(connectionViewsCur, connectionViewsPrev) },
      }
```

- [ ] **Step 6: 型別檢查**

Run: `npx tsc --noEmit`
Expected:無與 `analytics.ts` 相關錯誤。

- [ ] **Step 7: Commit**

```bash
git add server/routers/analytics.ts
git commit -m "feat(api): record product/connection views and add to seller stats"
```

---

## Task 4: `product.popular` tRPC procedure

**Files:**
- Modify: `server/routers/product.ts`

`ctx.db` 未帶 Database 泛型,`ctx.db.rpc(...)` 回傳 `any`,不需重新產生型別。

- [ ] **Step 1: 在頂部 `type ProductSearchRow = {…}` 之後新增回傳型別**

```ts
type PopularProductRow = {
  id: string
  name: string
  brand: string | null
  category: string | null
  model_number: string | null
  catalog_image_url: string | null
  wish_count: number | null
  view_count: number
}
```

- [ ] **Step 2: 在 `browse` procedure 之後新增 `popular`**

```ts
  // 首頁「熱門商品」:依 product_views 排序,無瀏覽者以最新遞補(見 popular_products RPC)
  popular: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(24).default(12) }).optional())
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.db.rpc('popular_products', {
        result_limit: input?.limit ?? 12,
      })
      if (error) throw error
      return (data ?? []) as PopularProductRow[]
    }),
```

- [ ] **Step 3: 型別檢查**

Run: `npx tsc --noEmit`
Expected:無相關錯誤。

- [ ] **Step 4: Commit**

```bash
git add server/routers/product.ts
git commit -m "feat(api): add product.popular query"
```

---

## Task 5: 商品頁記錄瀏覽

**Files:**
- Modify: `app/(buyer)/products/[id]/page-client.tsx`

沿用 listing 頁的記錄模式:資料載入後、非建立者、同 session 去重。

- [ ] **Step 1: 加入 `useSession` import**

在既有 import 區(`import { PageBreadcrumb } …` 附近)加入:

```ts
import { useSession } from '@/lib/context/session-context'
```

- [ ] **Step 2: 宣告 session**

找到:

```ts
  const searchParams = useSearchParams()
```

在其後加入:

```ts
  const session = useSession()
```

- [ ] **Step 3: 加入記錄瀏覽的 mutation 與 effect**

找到:

```ts
  const { data: product, isLoading } = trpc.product.getById.useQuery({ id })
```

在其後(brandLabel 之前或之後皆可)加入:

```ts
  const recordView = trpc.analytics.recordProductView.useMutation()
  useEffect(() => {
    if (!product) return
    if (session?.user?.id === product.created_by) return
    const key = `pv_${id}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    recordView.mutate({ product_id: id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product])
```

- [ ] **Step 4: 型別檢查**

Run: `npx tsc --noEmit`
Expected:無相關錯誤(`useEffect` 已在此檔 import)。

- [ ] **Step 5: Commit**

```bash
git add "app/(buyer)/products/[id]/page-client.tsx"
git commit -m "feat(product): record product page views"
```

---

## Task 6: 連線頁記錄瀏覽

**Files:**
- Modify: `app/(buyer)/connections/[id]/page.tsx`

此檔已有 `const session = useSession()`。

- [ ] **Step 1: 在 react import 補上 `useEffect`**

把:

```ts
import { use } from 'react'
```

改為:

```ts
import { use, useEffect } from 'react'
```

- [ ] **Step 2: 加入記錄瀏覽的 mutation 與 effect**

找到:

```ts
  const { data: connection, isLoading } = trpc.connection.getById.useQuery({ id })
```

在其後加入:

```ts
  const recordView = trpc.analytics.recordConnectionView.useMutation()
  useEffect(() => {
    if (!connection) return
    if (session?.user?.id === connection.seller_id) return
    const key = `cv_${id}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    recordView.mutate({ connection_id: id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection])
```

- [ ] **Step 3: 型別檢查**

Run: `npx tsc --noEmit`
Expected:無相關錯誤。

- [ ] **Step 4: Commit**

```bash
git add "app/(buyer)/connections/[id]/page.tsx"
git commit -m "feat(connection): record connection page views"
```

---

## Task 7: 賣家後台數據頁新增兩張卡

**Files:**
- Modify: `components/seller/analytics-stats.tsx`

- [ ] **Step 1: 在 icon import 補上 `Package` 與 `MapPin`**

把:

```ts
import { TrendingUp, TrendingDown, Minus, Eye, Users, Camera, AtSign, MessageCircle, Bookmark, UserPlus, Heart } from 'lucide-react'
```

改為:

```ts
import { TrendingUp, TrendingDown, Minus, Eye, Users, Camera, AtSign, MessageCircle, Bookmark, UserPlus, Heart, Package, MapPin } from 'lucide-react'
```

- [ ] **Step 2: skeleton 數量 8 → 10**

把:

```tsx
          {Array.from({ length: 8 }).map((_, i) => (
```

改為:

```tsx
          {Array.from({ length: 10 }).map((_, i) => (
```

- [ ] **Step 3: 新增兩張 StatCard**

把:

```tsx
          <StatCard label="心願符合" icon={<Heart className="h-4 w-4" />} current={data.wishMatches.current} trend={data.wishMatches.trend} />
        </div>
```

改為:

```tsx
          <StatCard label="心願符合" icon={<Heart className="h-4 w-4" />} current={data.wishMatches.current} trend={data.wishMatches.trend} />
          <StatCard label="商品瀏覽" icon={<Package className="h-4 w-4" />} current={data.productViews.current} trend={data.productViews.trend} />
          <StatCard label="連線瀏覽" icon={<MapPin className="h-4 w-4" />} current={data.connectionViews.current} trend={data.connectionViews.trend} />
        </div>
```

- [ ] **Step 4: 型別檢查**

Run: `npx tsc --noEmit`
Expected:無相關錯誤(`data.productViews` / `data.connectionViews` 由 Task 3 提供)。

- [ ] **Step 5: Commit**

```bash
git add components/seller/analytics-stats.tsx
git commit -m "feat(dashboard): show product/connection view stats"
```

---

## Task 8: E2E — 商品頁記錄一筆瀏覽(驗證 Task 1/3/5)

**Files:**
- Modify: `tests/buyer.spec.ts`

`buyer` 專案以買家帳號執行;seed 商品由賣家建立,故買家瀏覽不會被「擁有者略過」。

- [ ] **Step 1: 在 `tests/buyer.spec.ts` 新增 describe**

在檔案末尾(最後一個 `})` 之後)加入:

```ts
test.describe('瀏覽記錄', () => {
  test.afterEach(async () => {
    await dbAdmin().from('product_views').delete().eq('product_id', seed.productId)
  })

  test('開啟商品頁會新增一筆 product_views', async ({ page }) => {
    await page.goto(`/products/${seed.productId}`)
    await expect(page.getByText(seed.productName).first()).toBeVisible({ timeout: 20000 })
    await expect
      .poll(async () => {
        const { count } = await dbAdmin()
          .from('product_views')
          .select('id', { count: 'exact', head: true })
          .eq('product_id', seed.productId)
        return count ?? 0
      }, { timeout: 15000 })
      .toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: 跑測試,確認通過**

Run: `npx playwright test --project=buyer buyer.spec.ts -g "product_views"`
Expected:PASS(Task 1/3/5 完成後)。若 FAIL,先確認 migration 已套用、dev server 已起。

- [ ] **Step 3: Commit**

```bash
git add tests/buyer.spec.ts
git commit -m "test(product): e2e product view is recorded"
```

---

## Task 9: E2E — 先寫(會失敗的)首頁區塊測試

**Files:**
- Modify: `tests/buyer.spec.ts`

- [ ] **Step 1: 在 `'買家瀏覽與搜尋'` describe 內,既有「首頁、搜尋…渲染」測試之後新增**

```ts
  test('首頁顯示主視覺、分類、熱門商品(含 seed 商品)與成為賣家 CTA', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: '找到最適合你的日本代購' })
    ).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: '商品分類' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '熱門商品' })).toBeVisible()
    await expect(page.getByText(seed.productName).first()).toBeVisible({ timeout: 20000 })
    await expect(
      page.getByRole('heading', { name: '成為 Kozukase 賣家' })
    ).toBeVisible()
  })
```

- [ ] **Step 2: 跑測試,確認失敗**

Run: `npx playwright test --project=buyer buyer.spec.ts -g "主視覺"`
Expected:FAIL — 目前首頁沒有「熱門商品」區塊。

- [ ] **Step 3: Commit**

```bash
git add tests/buyer.spec.ts
git commit -m "test(home): add homepage sections e2e (failing)"
```

---

## Task 10: `HomeHero` 主視覺元件

**Files:**
- Create: `app/_home/home-hero.tsx`

背景目前用品牌色漸層 + 深色遮罩;日後換照片只需把第一個漸層 `div` 換成 `<Image fill className="object-cover">` 或加 `style={{ backgroundImage }}`。建議圖 2400×1000。

- [ ] **Step 1: 建立元件**

```tsx
import { HomeSearchBar } from '../home-search-bar'

export function HomeHero() {
  return (
    <section className="relative overflow-hidden border-b">
      {/* 背景:之後換成實際日本街景照即可(目前用品牌色漸層墊底) */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-brand-700 to-brand-500" />
      <div aria-hidden className="absolute inset-0 bg-black/45" />

      <div className="relative mx-auto max-w-2xl px-4 py-24 text-center md:py-32">
        <h1 className="font-heading text-3xl font-bold leading-tight text-white md:text-5xl">
          找到最適合你的日本代購
        </h1>
        <p className="mt-4 text-base text-white/85 md:text-lg">
          比較多家代購的價格、評價、運送速度,一次搞定
        </p>
        <div className="mx-auto mt-8 max-w-xl">
          <HomeSearchBar />
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: 型別檢查** — Run: `npx tsc --noEmit`,Expected:無相關錯誤。

- [ ] **Step 3: Commit**

```bash
git add app/_home/home-hero.tsx
git commit -m "feat(home): add HomeHero section"
```

---

## Task 11: `SectionCarousel` 橫向滑動區塊

**Files:**
- Create: `app/_home/section-carousel.tsx`

- [ ] **Step 1: 建立元件**

```tsx
'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function SectionCarousel({
  title,
  viewAllHref,
  children,
}: {
  title: string
  viewAllHref: string
  children: React.ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (dir: 1 | -1) => {
    scrollRef.current?.scrollBy({ left: dir * 360, behavior: 'smooth' })
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-heading text-xl font-bold text-foreground md:text-2xl">{title}</h2>
        <Link href={viewAllHref} className="shrink-0 text-sm font-medium text-brand-700 hover:underline">
          看全部 →
        </Link>
      </div>

      <div className="group relative">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scroll-smooth pb-2 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {children}
        </div>

        <button
          type="button"
          aria-label="往左捲動"
          onClick={() => scroll(-1)}
          className="absolute left-1 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border-soft bg-white p-2 shadow-md hover:bg-muted md:flex"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="往右捲動"
          onClick={() => scroll(1)}
          className="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border-soft bg-white p-2 shadow-md hover:bg-muted md:flex"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: 型別檢查** — Run: `npx tsc --noEmit`,Expected:無相關錯誤。

- [ ] **Step 3: Commit**

```bash
git add app/_home/section-carousel.tsx
git commit -m "feat(home): add SectionCarousel horizontal scroller"
```

---

## Task 12: 改寫 `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`(整檔取代)

- [ ] **Step 1: 整檔取代 `app/page.tsx`**

```tsx
import Link from 'next/link'
import { format } from 'date-fns'
import {
  ShoppingBag, Sparkles, Candy, Smartphone, Home, Gamepad2, MoreHorizontal,
  HeartPulse, Dumbbell, BookOpen, PawPrint, Landmark, Car, Baby, Gem, Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { ProductCard } from '@/components/product/product-card'
import { ConnectionCard } from '@/components/connection/connection-card'
import { createServerCaller } from '@/lib/trpc/server'
import { HomeHero } from './_home/home-hero'
import { SectionCarousel } from './_home/section-carousel'

const categories = [
  { key: 'fashion', label: '時尚穿搭', icon: ShoppingBag },
  { key: 'beauty', label: '美妝保養', icon: Sparkles },
  { key: 'health', label: '保健品', icon: HeartPulse },
  { key: 'food', label: '食品零食', icon: Candy },
  { key: 'electronics', label: '3C 電器', icon: Smartphone },
  { key: 'lifestyle', label: '生活雜貨', icon: Home },
  { key: 'sports', label: '運動戶外', icon: Dumbbell },
  { key: 'toys', label: '公仔玩具', icon: Gamepad2 },
  { key: 'books', label: '書籍文具', icon: BookOpen },
  { key: 'pets', label: '寵物用品', icon: PawPrint },
  { key: 'culture', label: '文化紀念品', icon: Landmark },
  { key: 'automotive', label: '汽機車用品', icon: Car },
  { key: 'baby', label: '母嬰用品', icon: Baby },
  { key: 'jewelry', label: '珠寶首飾', icon: Gem },
  { key: 'idol', label: '明星偶像', icon: Star },
  { key: 'other', label: '其他', icon: MoreHorizontal },
]

export default async function HomePage() {
  const trpc = await createServerCaller()
  const today = format(new Date(), 'yyyy-MM-dd')

  const [popularProducts, connectionsResult] = await Promise.all([
    trpc.product.popular({ limit: 12 }),
    trpc.connection.browse({ active_during: { start: today }, page: 1, limit: 10 }),
  ])
  const upcomingConnections = connectionsResult.items

  return (
    <>
      <Header />
      <main className="flex-1">
        <HomeHero />

        {/* Categories */}
        <section className="mx-auto max-w-7xl px-4 py-10">
          <h2 className="font-heading text-xl font-bold mb-5 text-foreground md:text-2xl">商品分類</h2>
          <div className="grid grid-cols-5 gap-1 md:grid-cols-8">
            {categories.map((cat) => {
              const Icon = cat.icon
              return (
                <Link
                  key={cat.key}
                  href={`/search?category=${cat.key}`}
                  className="flex flex-col items-center gap-2 rounded-md p-3 transition-colors hover:bg-muted"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs text-center text-muted-foreground leading-tight">{cat.label}</span>
                </Link>
              )
            })}
          </div>
        </section>

        {/* 熱門商品 */}
        {popularProducts.length > 0 && (
          <div className="bg-surface-muted/40">
            <SectionCarousel title="熱門商品" viewAllHref="/search">
              {popularProducts.map((p) => (
                <div key={p.id} className="w-40 shrink-0 snap-start md:w-44">
                  <ProductCard product={p} />
                </div>
              ))}
            </SectionCarousel>
          </div>
        )}

        {/* 即將出發的連線代購 */}
        {upcomingConnections.length > 0 && (
          <SectionCarousel title="即將出發的連線代購" viewAllHref="/connections">
            {upcomingConnections.map((c) => (
              <div key={c.id} className="w-72 shrink-0 snap-start">
                <ConnectionCard connection={c} />
              </div>
            ))}
          </SectionCarousel>
        )}

        {/* CTA */}
        <section className="border-t bg-foreground">
          <div className="mx-auto max-w-2xl px-4 py-16 text-center md:py-20">
            <h2 className="font-heading text-2xl font-bold text-background md:text-3xl">成為 Kozukase 賣家</h2>
            <p className="mt-3 text-sm text-background/60">讓更多買家找到你的代購服務</p>
            <Button
              size="lg"
              className="mt-8 bg-background text-foreground hover:bg-background/90"
              render={<Link href="/become-seller" />}
            >
              立即上架
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 2: 型別檢查** — Run: `npx tsc --noEmit`,Expected:無錯誤。

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(home): rebuild homepage with hero + carousels"
```

---

## Task 13: 跑綠 + 建置 + 手動確認

- [ ] **Step 1: 首頁 E2E 跑綠**

Run: `npx playwright test --project=buyer buyer.spec.ts -g "主視覺"`
Expected:PASS。

- [ ] **Step 2: 整個 buyer 專案不退步**

Run: `npx playwright test --project=buyer buyer.spec.ts`
Expected:全部 PASS(含 product_views 測試)。

- [ ] **Step 3: Lint + build**

Run: `npm run lint`(Expected:無錯誤)
Run: `npm run build`(Expected:成功;首頁為動態渲染)

- [ ] **Step 4: 手動瀏覽器確認**

`npm run dev` → 開 `http://localhost:3000`:
- 主視覺:漸層底 + 深色遮罩、白字清楚、搜尋鈕品牌綠;送出會到 `/search?q=…`。
- 商品分類:16 圖示可進 `/search?category=…`。
- 熱門商品:可左右滑、桌機箭頭可平滑捲動、「看全部 →」到 `/search`;無含 active 刊登的商品時整排不顯示(正常)。
- 即將出發的連線:可左右滑、「看全部 →」到 `/connections`;無進行中連線時整排不顯示(正常)。
- 成為賣家 CTA:到 `/become-seller`。
- 手機寬度:主視覺縮小、分類 5 欄、卡片可觸控橫滑。

接著確認本次新增的瀏覽記錄與後台:
- 用**非賣家本人**帳號開一個連線頁 `/connections/[id]`,到 DB 確認 `connection_views` 多一筆(同 session 重整不會重複)。
- 用**賣家**帳號進賣家後台數據頁,確認多了「商品瀏覽」「連線瀏覽」兩張卡且數字正常。

- [ ] **Step 5: Commit(若 Step 1–4 有修正才需要)**

```bash
git add -A
git commit -m "test(home): verify homepage + view tracking green"
```

---

## Self-Review 對照

- **Spec §4.0 補瀏覽記錄** → Task 1(表)、Task 3(record procedures)、Task 5(商品頁)、Task 6(連線頁)。
- **Spec §3.3 / §4.1 熱門商品(商品瀏覽,無則最新)** → Task 2(RPC)、Task 4(procedure)、Task 12(渲染、空則隱藏);Task 8 驗證瀏覽有記、Task 9 驗證首頁出現。
- **Spec §3.4 即將出發的連線(日期排)** → Task 12(`connection.browse` + `active_during.start=今天`,空則隱藏)。
- **Spec §4.3 後台兩指標** → Task 3(getSellerStats)、Task 7(兩張卡)。
- **Spec §3.1 主視覺** → Task 10;**§3.2 分類**、**§3.5 CTA** → Task 12;**§6 橫滑/RWD/空狀態/SSR** → Task 11 + Task 12。
- **Spec §7 非目標**:未含促銷 Banner、熱門許願、卡片重畫、真實圖、Header/Footer 改動。✅

型別一致:`PopularProductRow` 對齊 `ProductCardProduct`;`getSellerStats` 新增 `productViews`/`connectionViews` 與 `analytics-stats.tsx` 使用一致;record procedure 名稱(`recordProductView`/`recordConnectionView`)在 router 與兩個詳情頁一致。無 placeholder。
