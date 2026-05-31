# 賣家「可提供購買證明 / 明細」欄位 + 搜尋篩選 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓賣家能標示「可提供購買證明 / 明細」，買家在搜尋頁可勾選此條件篩選商品與代購。

**Architecture:** 完全比照現有「社群驗證」篩選（`sellers.is_social_verified` → search `social` 參數）的資料流。新增 `sellers.can_provide_proof` 布林欄位，串到賣家表單、兩個 browse procedure（product / listing）與搜尋頁篩選 UI。

**Tech Stack:** Next.js (App Router) + tRPC + Zod + Supabase (Postgres) + Playwright (e2e)。

> ⚠️ **使用者指示：本次全程不要 git commit。** 計畫中每個 "Checkpoint" 取代原本的 commit 步驟 —— 只做驗證、不提交。分支維持在 `dev`。

---

## File Structure

| 檔案 | 動作 | 責任 |
|------|------|------|
| `supabase/migrations/00043_add_can_provide_proof_to_sellers.sql` | Create | 新增 `sellers.can_provide_proof` 欄位 |
| `lib/validators/seller.ts` | Modify | `becomeSellerInput` / `updateSellerInput` 加欄位 |
| `lib/validators/listing.ts` | Modify | `browseListingsInput` 加 `proofOnly` |
| `lib/validators/product.ts` | Modify | `browseProductsInput` 加 `proofOnly` |
| `server/routers/seller.ts` | Modify | `becomeSeller` insert 帶入新欄位 |
| `server/routers/listing.ts` | Modify | `browse` 套用 `proofOnly` 篩選 + select 帶回欄位 |
| `server/routers/product.ts` | Modify | `browse` 套用 `proofOnly` 篩選 + select 帶回欄位 |
| `app/(user)/become-seller/page.tsx` | Modify | 申請表單加勾選框 |
| `app/(seller)/dashboard/profile/page.tsx` | Modify | 後台編輯加開關 |
| `app/(buyer)/search/page-client.tsx` | Modify | 篩選參數 / UI / chip / 查詢參數 / 序列化 |
| `tests/buyer.spec.ts` | Modify | 新增 `proofOnly` 篩選的 API 層測試 |

---

## Task 1: 資料庫 migration

**Files:**
- Create: `supabase/migrations/00043_add_can_provide_proof_to_sellers.sql`

- [ ] **Step 1: 建立 migration 檔**

`supabase/migrations/00043_add_can_provide_proof_to_sellers.sql`:

```sql
-- 賣家可標示是否提供購買證明 / 明細（供買家辨別正品）。
-- 比照 is_social_verified，作為 search 篩選條件使用。
ALTER TABLE sellers
  ADD COLUMN can_provide_proof boolean NOT NULL DEFAULT false;
```

- [ ] **Step 2: 套用 migration 到開發 / 測試 DB**

Run: `npx supabase db push`
（若使用本機 stack 則 `npx supabase migration up`。）
Expected: migration `00043` 套用成功，無錯誤。

- [ ] **Step 3: 驗證欄位存在**

Run:
```bash
npx supabase db push --dry-run
```
Expected: 顯示無待套用變更（代表 00043 已套用）。

- [ ] **Step 4: Checkpoint** — 回報 migration 已套用，等待往下。

---

## Task 2: 後端篩選（驗證器 + router）— TDD

**Files:**
- Test: `tests/buyer.spec.ts`
- Modify: `lib/validators/listing.ts:55-63`
- Modify: `lib/validators/product.ts:22-33`
- Modify: `server/routers/listing.ts:46-69`
- Modify: `server/routers/product.ts:51-93`

- [ ] **Step 1: 寫失敗測試**

在 `tests/buyer.spec.ts` 檔尾新增（使用既有 `dbAdmin` 與 `trpcMutate` helper 模式；此處直接走未驗證的 public GET 查詢，故用 `request.post` 呼叫 tRPC query 的 batch GET 形式 —— 比照現有 buyer.spec 的查詢測試寫法）。若 buyer.spec 既有以 `request` 呼叫 `listing.browse` 的範例，沿用同一輔助函式；否則新增下列 helper 與測試：

```ts
import { test, expect } from '@playwright/test'
import { dbAdmin } from './helpers/db'

// 透過 tRPC httpBatchLink 的 query GET 形式呼叫 public procedure。
async function trpcQuery<T = unknown>(
  request: import('@playwright/test').APIRequestContext,
  procedure: string,
  input: unknown,
): Promise<T> {
  const encoded = encodeURIComponent(JSON.stringify({ '0': { json: input } }))
  const res = await request.get(`/api/trpc/${procedure}?batch=1&input=${encoded}`)
  const json = await res.json()
  const result = Array.isArray(json) ? json[0] : json
  if (result.error) throw new Error(result.error?.json?.message ?? 'trpc error')
  const data = result.result?.data
  return (data?.json !== undefined ? data.json : data) as T
}

test.describe('購買證明篩選', () => {
  const tag = `[E2E-PROOF] ${Date.now()}`
  let proofSellerId: string
  let plainSellerId: string

  test.afterAll(async () => {
    const db = dbAdmin()
    await db.from('listings').delete().like('title', '[E2E-PROOF]%')
    await db.from('products').delete().like('name', '[E2E-PROOF]%')
  })

  test('listing.browse proofOnly 只回傳可提供購買證明的賣家', async ({ request }) => {
    const db = dbAdmin()

    // 取兩個既有賣家：一個設 can_provide_proof=true，一個 false
    const { data: sellers } = await db.from('sellers').select('id').limit(2)
    expect(sellers && sellers.length).toBeGreaterThanOrEqual(2)
    proofSellerId = sellers![0].id
    plainSellerId = sellers![1].id
    await db.from('sellers').update({ can_provide_proof: true }).eq('id', proofSellerId)
    await db.from('sellers').update({ can_provide_proof: false }).eq('id', plainSellerId)

    // 各建立一個 active listing（共用一個商品）
    const { data: prod } = await db
      .from('products')
      .insert({ name: `${tag} 商品`, category: 'other' })
      .select('id')
      .single()
    const productId = prod!.id
    await db.from('listings').insert([
      { product_id: productId, seller_id: proofSellerId, status: 'active', title: `${tag} A`, post_url: 'x', is_price_on_request: true },
      { product_id: productId, seller_id: plainSellerId, status: 'active', title: `${tag} B`, post_url: 'x', is_price_on_request: true },
    ])

    const res = await trpcQuery<{ items: { seller: { id: string } }[] }>(
      request,
      'listing.browse',
      { query: `${tag}`, proofOnly: true, page: 1, limit: 50 },
    )
    const sellerIds = res.items.map((i) => i.seller.id)
    expect(sellerIds).toContain(proofSellerId)
    expect(sellerIds).not.toContain(plainSellerId)
  })
})
```

> 注意：`category` 欄位值（此處用 `'other'`）需符合 `product_category` enum；若 enum 無 `other`，改用 `tests/helpers/db.ts` 的 `seedListing` 既有流程取得合法 category。實作前先確認 enum 合法值。

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx playwright test tests/buyer.spec.ts -g "proofOnly"`
Expected: FAIL —— `proofOnly` 尚未被 schema 接受 / 篩選未生效，回傳含 `plainSellerId`。

- [ ] **Step 3: 驗證器加 `proofOnly`**

`lib/validators/listing.ts`（在 `inStockOnly` 後）:

```ts
export const browseListingsInput = z.object({
  query: z.string().max(200).optional(),
  category: productCategoryEnum.optional(),
  brandId: z.string().uuid().optional(),
  socialVerifiedOnly: z.boolean().optional(),
  inStockOnly: z.boolean().optional(),
  proofOnly: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(50).default(20),
})
```

`lib/validators/product.ts`（在 `socialVerifiedOnly` 後）:

```ts
export const browseProductsInput = z.object({
  query: z.string().max(200).optional(),
  category: productCategoryEnum.optional(),
  brandId: z.string().uuid().optional(),
  region: z.string().uuid().optional(),
  priceMin: z.number().min(0).optional(),
  priceMax: z.number().min(0).optional(),
  shippingDaysMax: z.number().min(1).optional(),
  socialVerifiedOnly: z.boolean().optional(),
  proofOnly: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(50).default(20),
})
```

- [ ] **Step 4: `listing.browse` 套用篩選 + select 帶回欄位**

`server/routers/listing.ts`，select 字串（第 51 行）加入 `can_provide_proof`:

```ts
seller:sellers(id, name, avg_rating, review_count, is_social_verified, can_provide_proof, avatar_url, ig_handle, threads_handle)`,
```

在 `inStockOnly` 區塊（第 71-73 行）之後新增（比照 `socialVerifiedOnly` 的兩段式，避免巢狀關聯篩選失準）:

```ts
      if (input.proofOnly) {
        const { data: proofSellers } = await ctx.db
          .from('sellers')
          .select('id')
          .eq('can_provide_proof', true)
        const ids = (proofSellers ?? []).map((r) => r.id)
        const safeIds = ids.length ? ids : ['00000000-0000-0000-0000-000000000000']
        query = query.in('seller_id', safeIds)
      }
```

- [ ] **Step 5: `product.browse` 套用篩選 + select 帶回欄位**

`server/routers/product.ts`，inner join 的 seller 欄位（第 57 行）改為:

```ts
          listings!inner(price, shipping_date, status, seller_id, seller:sellers!inner(is_social_verified, can_provide_proof))
```

在 `socialVerifiedOnly` 區塊（第 91-93 行）之後新增:

```ts
      if (input.proofOnly) {
        query = query.eq('listings.seller.can_provide_proof', true)
      }
```

- [ ] **Step 6: 執行測試確認通過**

Run: `npx playwright test tests/buyer.spec.ts -g "proofOnly"`
Expected: PASS。

- [ ] **Step 7: Checkpoint** — 回報後端篩選完成，等待往下。

---

## Task 3: 賣家 router 寫入新欄位

**Files:**
- Modify: `server/routers/seller.ts:22-34`

`update` procedure 已用 `...sellerData` 透傳，Task 2 加了驗證器即生效，無需改動。僅需改 `becomeSeller`。

- [ ] **Step 1: `becomeSeller` insert 帶入欄位**

`server/routers/seller.ts`，insert 物件（第 24-32 行）加入一行:

```ts
        .insert({
          id: ctx.user.id,
          name: input.name,
          phone_number: input.phone_number ?? null,
          // 尚未實作 OTP 驗證，不可謊稱已驗證；待 OTP 流程上線後改由驗證結果決定
          phone_verified: false,
          bio: input.bio ?? null,
          avatar_url: input.avatar_url ?? null,
          can_provide_proof: input.can_provide_proof ?? false,
        })
```

- [ ] **Step 2: 驗證器加欄位**

`lib/validators/seller.ts`:

```ts
export const becomeSellerInput = z.object({
  name: z.string().min(1, '賣家名稱為必填').max(50),
  phone_number: z.string().min(8).max(20).optional(),
  region_ids: z.array(z.string().uuid()).min(1, '請至少選擇一個代購地區'),
  bio: z.string().max(300).optional(),
  avatar_url: httpUrl.optional(),
  can_provide_proof: z.boolean().optional(),
})

export const updateSellerInput = z.object({
  name: z.string().min(1).max(50).optional(),
  region_ids: z.array(z.string().uuid()).min(1).optional(),
  bio: z.string().max(300).optional(),
  avatar_url: httpUrl.nullable().optional(),
  can_provide_proof: z.boolean().optional(),
})
```

- [ ] **Step 3: typecheck**

Run: `npx tsc --noEmit`
Expected: 無型別錯誤。

- [ ] **Step 4: Checkpoint** — 回報 router/validator 完成。

---

## Task 4: 賣家端表單 UI

**Files:**
- Modify: `app/(user)/become-seller/page.tsx`
- Modify: `app/(seller)/dashboard/profile/page.tsx`

### 4a. 申請成為賣家頁

- [ ] **Step 1: 加 state**

`app/(user)/become-seller/page.tsx`，在 `const [agree, setAgree] = useState(false)`（第 114 行）附近新增:

```ts
  const [canProvideProof, setCanProvideProof] = useState(false)
```

- [ ] **Step 2: 送出時帶入**

`becomeSeller.mutateAsync` 呼叫（第 213-218 行）加入:

```ts
      await becomeSeller.mutateAsync({
        name: sellerName.trim(),
        region_ids: selectedRegions,
        bio: bio.trim() || undefined,
        avatar_url: finalAvatarUrl,
        can_provide_proof: canProvideProof,
      })
```

- [ ] **Step 3: 加勾選框 UI（比照既有 `agree` 勾選框寫法）**

在「簡介」FormSection（第 452 行 `</FormSection>` 之後、`{/* Agreement + submit */}` 之前）插入:

```tsx
              <label className="flex items-start gap-2.5 cursor-pointer mt-2">
                <button type="button" onClick={() => setCanProvideProof(v => !v)}
                  className="w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center flex-shrink-0 mt-0.5 transition-[background,border-color]"
                  style={{ background: canProvideProof ? 'var(--text-strong)' : 'var(--surface-card)', borderColor: canProvideProof ? 'var(--text-strong)' : 'var(--border-strong)', color: canProvideProof ? 'var(--text-inverse)' : 'transparent' }}
                >
                  {canProvideProof && <Check size={11} strokeWidth={2.5} />}
                </button>
                <span className="text-[13px] text-text-muted leading-[1.55] pt-0.5">
                  我可提供購買證明 / 明細（如收據、購買紀錄，協助買家辨別正品）
                </span>
              </label>
```

> `Check` 圖示已於此檔 import（`agree` 勾選框使用中），無需新增 import。

### 4b. 賣家後台編輯資料頁

- [ ] **Step 4: 加 state**

`app/(seller)/dashboard/profile/page.tsx`，在 `const [bio, setBio] = useState('')`（第 33 行）附近新增:

```ts
  const [canProvideProof, setCanProvideProof] = useState(false)
```

- [ ] **Step 5: 載入既有值**

在 `setBio((seller.bio as string | null) ?? '')`（第 92 行）之後新增:

```ts
      setCanProvideProof(Boolean((seller as Record<string, unknown>).can_provide_proof))
```

- [ ] **Step 6: 送出時帶入**

`updateSeller.mutateAsync` 呼叫（第 366-372 行）加入:

```ts
      await updateSeller.mutateAsync(
        {
          name: trimmedName,
          bio: bio.trim() || undefined,
          region_ids: selectedRegions,
          avatar_url: finalAvatarUrl,
          can_provide_proof: canProvideProof,
        },
      )
```

- [ ] **Step 7: 加 UI（比照「簡介」的 grid 版面，用既有 Switch 元件）**

先在 import 區（第 6-17 行 `@/components/ui` 群組）新增:

```ts
import { Switch } from '@/components/ui/switch'
```

在「簡介」grid 區塊（第 491-505 行）之後插入:

```tsx
                <div className="grid grid-cols-[140px_1fr] items-start gap-x-4">
                  <Label className="pt-2">購買證明</Label>
                  <div className="flex items-center gap-3 pt-1">
                    <Switch checked={canProvideProof} onCheckedChange={setCanProvideProof} />
                    <span className="text-sm text-muted-foreground">可提供購買證明 / 明細（協助買家辨別正品）</span>
                  </div>
                </div>
```

- [ ] **Step 8: typecheck**

Run: `npx tsc --noEmit`
Expected: 無型別錯誤。

- [ ] **Step 9: 既有賣家後台測試回歸**

Run: `npx playwright test tests/seller.spec.ts -g "賣家資料頁渲染"`
Expected: PASS（頁面仍正常渲染）。

- [ ] **Step 10: Checkpoint** — 回報賣家表單完成。

---

## Task 5: 買家搜尋頁篩選 UI

**Files:**
- Modify: `app/(buyer)/search/page-client.tsx`

- [ ] **Step 1: 加篩選參數 parser**

`filterParsers`（第 34-42 行）在 `stock` 之後新增:

```ts
const filterParsers = {
  category: parseAsString,
  brand: parseAsString,
  social: parseAsBoolean.withDefault(false),
  // 僅作用於「代購」分頁（is_in_stock）；商品分頁無現貨概念
  stock: parseAsBoolean.withDefault(false),
  proof: parseAsBoolean.withDefault(false),
  tab: parseAsStringEnum(['listings', 'products'] as const).withDefault('listings'),
  page: parseAsInteger.withDefault(1),
}
```

- [ ] **Step 2: 解構 state**

`useQueryStates` 解構（第 64 行）加入 `proof`:

```ts
  const [{ category, brand: brandId, social: socialVerifiedOnly, stock: inStockOnly, proof: proofOnly, tab, page }, setParams] = useQueryStates(
    filterParsers,
```

- [ ] **Step 3: 傳入兩個 browse 查詢**

`product.browse`（第 86-94 行）與 `listing.browse`（第 108-117 行）的 input 各加一行:

```ts
      proofOnly: proofOnly || undefined,
```

（product 加在 `socialVerifiedOnly` 後；listing 加在 `inStockOnly` 後。）

- [ ] **Step 4: active filter chip**

在 social 的 activeFilters 區塊（第 165-172 行）之後新增:

```ts
  if (proofOnly) {
    activeFilters.push({
      key: 'proof',
      label: '可提供購買證明',
      color: KZ.teal,
      onRemove: () => setParams({ proof: false, page: 1 }),
    })
  }
```

- [ ] **Step 5: 篩選面板開關**

在「社群驗證」FilterSection（第 186-204 行）之後新增（兩分頁皆顯示，故不加 `tab` 條件）:

```tsx
      {/* 可提供購買證明 toggle */}
      <FilterSection
        title="可提供購買證明"
        titleExtra={
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger render={<span className="flex cursor-default items-center" />}>
                <Info className="size-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="right">只顯示願意提供購買證明 / 明細的賣家</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        }
        rightSlot={
          <Switch
            checked={proofOnly}
            onCheckedChange={(v) => setParams({ proof: v, page: 1 })}
          />
        }
      />
```

- [ ] **Step 6: 序列化（返回連結）**

`serializeSearch(...)` 呼叫（第 385 行）的物件加入 `proof: proofOnly`:

```ts
serializeSearch({ q, category, brand: brandId, social: socialVerifiedOnly, stock: inStockOnly, proof: proofOnly, tab, page: safePage })
```

- [ ] **Step 7: typecheck**

Run: `npx tsc --noEmit`
Expected: 無型別錯誤。

- [ ] **Step 8: lint**

Run: `npx eslint app/\(buyer\)/search/page-client.tsx`
Expected: 無錯誤。

- [ ] **Step 9: Checkpoint** — 回報搜尋頁 UI 完成。

---

## Task 6: 全量驗證

- [ ] **Step 1: 型別 + 建置**

Run: `npx tsc --noEmit && npx next build`
Expected: 皆成功。

- [ ] **Step 2: 跑相關 e2e**

Run: `npx playwright test tests/buyer.spec.ts tests/seller.spec.ts`
Expected: 全數 PASS。

- [ ] **Step 3: 手動回歸（可選）**

啟動 dev server，於 `/search` 切換「可提供購買證明」開關，確認商品/代購兩分頁都會篩選，chip 可移除，返回連結保留狀態。賣家後台 `/dashboard/profile` 開關可儲存並重新載入後保持。

- [ ] **Step 4: 最終 Checkpoint** — 回報完成。**不要 commit**（依使用者指示）；列出所有變更檔案，等待使用者決定後續。

---

## Self-Review 紀錄

- **Spec coverage**：migration（Task 1）、賣家設定欄位（Task 3+4）、買家兩分頁篩選（Task 2+5）、資料回傳供日後徽章（Task 2 select 帶 `can_provide_proof`）、測試（Task 2）、不做徽章/上傳（未列入）—— 全部對應。
- **Placeholder scan**：無 TBD / 含糊步驟；唯一條件性說明為 product enum 合法值需在 Task 2 Step 1 確認（已標註）。
- **Type consistency**：欄位名 `can_provide_proof`（DB / validator / router / seller select）與輸入名 `proofOnly`（browse input / 查詢參數）、UI 參數 `proof`（querystring）三者用途一致，全程統一。
