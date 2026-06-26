# 新增代購流程改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把賣家新增代購從「先選/新增商品 → 再填代購」兩關，改成「搜尋商品 → 選既有或按『沒有我的商品』→ 一張表單填完」，並把官方商品圖移除、只保留一套代購圖。

**Architecture:** 保留商品搜尋這一步；找不到商品時不再進獨立的商品表單，而是直接進代購表單，商品欄位內嵌在表單中間（價格與庫存與規格之間），送出時才默默建立商品。新增商品的代表圖＝把第一張代購圖再以 `product` 用途上傳一份（商品圖 API 僅接受 product 路徑金鑰）。不做 AI、不做合併、不改資料庫；買家端完全不動。

**Tech Stack:** Next.js 16 (App Router, client components)、tRPC、React 19、Tailwind、Playwright（e2e）。

## Global Constraints

- 所有 UI 文案使用繁體中文（非簡體）。
- 不改資料庫結構、不做 AI 去重、不做後台合併工具。
- 不改：買家端許願 / 收藏 / 瀏覽 / 比價邏輯；賣家「編輯既有代購」頁；買家「許願」頁。
- 不可破壞 `ProductPicker`（仍被 `app/(seller)/dashboard/listings/[id]/edit/page.tsx` 與 `app/(buyer)/wishes/new/page.tsx` 使用）。
- 新增流程全程只有一個圖片上傳處（代購圖）。
- 商品資訊區塊位置固定在「價格與庫存」與「規格」之間。
- 痛點二（商品名稱 vs 代購標題）本期不處理，兩個名稱欄並存。
- 商品圖後端 `upload.confirmProductImages` 只接受 `images/product/...` 路徑金鑰；代表圖必須以 `product` 用途上傳，不能沿用代購圖的 `listing` 金鑰。
- 本專案 React 元件沒有單元測試框架，行為驗證以 Playwright e2e（`tests/seller-create.spec.ts`）為主，元件層改動以 `npx tsc --noEmit` 與 `npm run lint` 為閘門。

## File Structure

- `components/product/product-search.tsx`（修改）：把「新增商品」那顆按鈕的文案改成可由 prop 覆寫（預設不變，避免影響許願/編輯流程）。
- `components/product/product-info-fields.tsx`（新增）：受控的商品欄位元件（商品名稱、品牌、型號、分類、國家），不含圖片、不含外框與「下一步」。
- `components/listing/listing-form.tsx`（修改）：新增 `productInfoSlot`，渲染成「商品資訊」分組置於價格與庫存與規格之間；`onCreateProduct` 改為接收封面檔。
- `app/(seller)/dashboard/listings/new/page.tsx`（改寫）：改用 `ProductSearch` 直接搜尋；選既有→顯示卡片；按「沒有我的商品」→ 內嵌商品欄位；送出時建立商品＋代表圖。
- `tests/seller-create.spec.ts`（修改）：更新為新流程，並驗證商品已建立且有代表圖。

---

### Task 1: ProductSearch 新增可覆寫的「新增商品」按鈕文案

**Files:**
- Modify: `components/product/product-search.tsx`

**Interfaces:**
- Produces: `ProductSearch` 新增 optional prop `createButtonLabel?: string`。提供時，建立按鈕文字＝該字串；未提供時維持現有 `新增商品「{query}」`。`onCreateNew(query)` 行為不變（仍把搜尋字往上傳，供商品名稱預填）。

- [ ] **Step 1: 在 props 介面加入 `createButtonLabel`**

於 `components/product/product-search.tsx` 修改介面（約第 19-22 行）：

```tsx
interface ProductSearchProps {
  onSelect: (product: ProductSearchResult) => void
  onCreateNew: (name: string) => void
  createButtonLabel?: string
}
```

並把函式簽名改為解構出新 prop：

```tsx
export function ProductSearch({ onSelect, onCreateNew, createButtonLabel }: ProductSearchProps) {
```

- [ ] **Step 2: 套用按鈕文案**

把建立按鈕（約第 96-105 行）的內容改為：

```tsx
{query.trim() && !showLoading && (
  <Button
    variant="cta-outline"
    className="w-full gap-2"
    onClick={() => onCreateNew(query.trim())}
  >
    <Plus className="h-4 w-4" />
    {createButtonLabel ?? `新增商品「${query.trim()}」`}
  </Button>
)}
```

- [ ] **Step 3: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤（既有 `ProductPicker` / 許願 / 編輯流程未傳 `createButtonLabel`，行為不變）。

- [ ] **Step 4: Commit**

```bash
git add components/product/product-search.tsx
git commit -m "feat(listing): ProductSearch 支援自訂新增商品按鈕文案"
```

---

### Task 2: 新增 ProductInfoFields 元件（內嵌商品欄位，無圖片）

**Files:**
- Create: `components/product/product-info-fields.tsx`

**Interfaces:**
- Produces:
  - `type ProductInfoData = { name: string; brand_id: string; modelNumber: string; category: ProductCategory | ''; regionId: string }`
    - `brand_id` 為 `BrandSelect` 原始值：`'none'`（無）、品牌 uuid、或 `'__new__:品牌名'`（延後建立）。初始用 `'none'`。
  - `function ProductInfoFields(props: { value: ProductInfoData; onChange: (v: ProductInfoData) => void; nameError?: string })`
- Consumes: `trpc.seller.getRegions`、`BrandSelect`、`PRODUCT_CATEGORY_LABELS`、`SearchableSelect`、`FormFieldError`、`OptionalTag`。

- [ ] **Step 1: 建立元件檔**

Create `components/product/product-info-fields.tsx`：

```tsx
'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { FormFieldError } from '@/components/shared/form-field-error'
import { OptionalTag } from '@/components/shared/form-section'
import { BrandSelect } from '@/components/shared/brand-select'
import { PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'
import { trpc } from '@/lib/trpc/client'
import type { ProductCategory } from '@/lib/validators/product'

export interface ProductInfoData {
  name: string
  /** BrandSelect 原始值：'none' | uuid | '__new__:品牌名' */
  brand_id: string
  modelNumber: string
  category: ProductCategory | ''
  regionId: string
}

interface ProductInfoFieldsProps {
  value: ProductInfoData
  onChange: (value: ProductInfoData) => void
  nameError?: string
}

export function ProductInfoFields({ value, onChange, nameError }: ProductInfoFieldsProps) {
  const { data: regions } = trpc.seller.getRegions.useQuery()
  const set = (patch: Partial<ProductInfoData>) => onChange({ ...value, ...patch })

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="product-name">商品名稱</Label>
        <Input
          id="product-name"
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
          placeholder="輸入商品名稱"
          aria-invalid={!!nameError}
        />
        <FormFieldError message={nameError} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>品牌<OptionalTag /></Label>
          <BrandSelect
            value={value.brand_id}
            onValueChange={(v) => set({ brand_id: v })}
            placeholder="選擇或新增品牌"
            deferred
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="product-model">型號<OptionalTag /></Label>
          <Input
            id="product-model"
            value={value.modelNumber}
            onChange={(e) => set({ modelNumber: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
            placeholder="輸入型號"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>分類<OptionalTag /></Label>
          <Select value={value.category || null} onValueChange={(v) => set({ category: v as ProductCategory })}>
            <SelectTrigger>
              <SelectValue placeholder="選擇分類">
                {(v: string | null) => v ? (PRODUCT_CATEGORY_LABELS[v] ?? v) : '選擇分類'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRODUCT_CATEGORY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>商品國家<OptionalTag /></Label>
          <SearchableSelect
            value={value.regionId}
            onValueChange={(v) => set({ regionId: v })}
            options={(regions ?? []).map((r: { id: string; name: string }) => ({ value: r.id, label: r.name }))}
            placeholder="選擇國家"
            searchPlaceholder="搜尋國家..."
            emptyText="找不到相符的國家"
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤。

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: 無新錯誤。

- [ ] **Step 4: Commit**

```bash
git add components/product/product-info-fields.tsx
git commit -m "feat(listing): 新增內嵌商品欄位元件 ProductInfoFields"
```

---

### Task 3: ListingForm 加入「商品資訊」中間分組，onCreateProduct 改收封面檔

**Files:**
- Modify: `components/listing/listing-form.tsx`

**Interfaces:**
- Consumes: `ReactNode`（已 import）。
- Produces:
  - `ListingForm` 新增 optional prop `productInfoSlot?: ReactNode`，渲染為標題「商品資訊」的 `FormSection`，位置在「價格與庫存」與「規格」之間；未提供時不渲染該分組。
  - `onCreateProduct` 型別改為 `(coverFile: File | null) => Promise<string>`；建立流程呼叫 `onCreateProduct(pendingFiles[0] ?? null)`。

- [ ] **Step 1: 介面新增 `productInfoSlot`、改 `onCreateProduct` 型別**

於 `components/listing/listing-form.tsx` 的 `ListingFormProps`（約第 113-125 行）內，把：

```tsx
  onCreateProduct?: () => Promise<string>
```

改為：

```tsx
  onCreateProduct?: (coverFile: File | null) => Promise<string>
```

並在 `productSlot?: ReactNode` 之後新增一行：

```tsx
  /** 「商品資訊」分組內容（卡片或可填欄位），渲染於價格與庫存與規格之間。 */
  productInfoSlot?: ReactNode
```

於函式解構（約第 127 行）加入 `productInfoSlot`：

```tsx
export function ListingForm({ productId, mode, initialData, onCreateProduct, productRemoved = false, productSlot, productInfoSlot }: ListingFormProps) {
```

- [ ] **Step 2: 建立流程把封面檔傳給 onCreateProduct**

於 `handleSave` 建立分支（約第 336-344 行），把：

```tsx
        resolvedProductId = await onCreateProduct()
```

改為：

```tsx
        resolvedProductId = await onCreateProduct(pendingFiles[0] ?? null)
```

- [ ] **Step 3: 在價格與庫存與規格之間插入「商品資訊」分組**

於 `</FormSection>`（價格與庫存分組結尾，約第 578 行）與 `{/* ── 規格 ── */}`（約第 580 行）之間插入：

```tsx
      {/* ── 商品資訊 ── */}
      {productInfoSlot && (
        <FormSection title="商品資訊">
          {productInfoSlot}
        </FormSection>
      )}

```

- [ ] **Step 4: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤。`new/page.tsx` 目前傳入的 `deferred.createProductForListing`（無參數）相容於新簽名（多餘參數被忽略），舊流程仍可編譯運作。

- [ ] **Step 5: Commit**

```bash
git add components/listing/listing-form.tsx
git commit -m "feat(listing): ListingForm 加入商品資訊分組與封面檔參數"
```

---

### Task 4: 改寫新增代購頁為單表單流程，並更新 e2e 測試

**Files:**
- Modify (rewrite): `app/(seller)/dashboard/listings/new/page.tsx`
- Modify: `tests/seller-create.spec.ts`

**Interfaces:**
- Consumes: `ProductSearch`（含 `createButtonLabel`，Task 1）、`ProductInfoFields` / `ProductInfoData`（Task 2）、`ListingForm`（`productInfoSlot` + 新 `onCreateProduct`，Task 3）、`SelectedProduct`（型別來自 `components/product/product-picker`）、`uploadImageFiles`、`trpc.brand.create` / `trpc.product.create` / `trpc.upload.confirmProductImages` / `trpc.upload.getPresignedUrl` / `trpc.upload.deleteObjects`。

- [ ] **Step 1: 改寫 `new/page.tsx`**

把 `app/(seller)/dashboard/listings/new/page.tsx` 全部內容替換為：

```tsx
'use client'

import { useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ProductCard } from '@/components/product/product-card'
import { ProductSearch, type ProductSearchResult } from '@/components/product/product-search'
import { ProductInfoFields, type ProductInfoData } from '@/components/product/product-info-fields'
import { ListingForm } from '@/components/listing/listing-form'
import { uploadImageFiles } from '@/components/shared/image-upload'
import { trpc } from '@/lib/trpc/client'
import type { SelectedProduct } from '@/components/product/product-picker'

const EMPTY_PRODUCT: ProductInfoData = { name: '', brand_id: 'none', modelNumber: '', category: '', regionId: '' }

export default function NewListingPage() {
  const [selected, setSelected] = useState<SelectedProduct | null>(null)
  const [creatingName, setCreatingName] = useState<string | null>(null)
  const [productDraft, setProductDraft] = useState<ProductInfoData>(EMPTY_PRODUCT)
  const [productNameError, setProductNameError] = useState('')

  // 建立成功後快取商品 id，讓部分失敗的重試不會重複建立商品。
  const createdProductIdRef = useRef<string | null>(null)

  const createBrand = trpc.brand.create.useMutation()
  const createProduct = trpc.product.create.useMutation()
  const confirmProductImages = trpc.upload.confirmProductImages.useMutation()
  const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation()
  const deleteObjects = trpc.upload.deleteObjects.useMutation()

  const backToSearch = () => {
    setSelected(null)
    setCreatingName(null)
    setProductNameError('')
    createdProductIdRef.current = null
  }

  const handleSelectExisting = (p: ProductSearchResult) => {
    createdProductIdRef.current = null
    setCreatingName(null)
    setSelected({
      id: p.id,
      name: p.name,
      brand_name: p.brand ?? null,
      model_number: p.model_number,
      catalog_image_url: p.catalog_image_url,
    })
  }

  const handleCreateNew = (name: string) => {
    createdProductIdRef.current = null
    setSelected(null)
    setProductDraft({ ...EMPTY_PRODUCT, name })
    setProductNameError('')
    setCreatingName(name)
  }

  // 上架時建立全新商品（保守不併），並把第一張代購圖以 product 用途上傳一份當代表圖。
  const createProductForListing = async (coverFile: File | null): Promise<string> => {
    if (createdProductIdRef.current) return createdProductIdRef.current

    const name = productDraft.name.trim()
    if (!name) {
      setProductNameError('商品名稱為必填')
      throw new Error('商品名稱為必填')
    }
    setProductNameError('')

    let brandId: string | undefined = productDraft.brand_id === 'none' ? undefined : productDraft.brand_id
    if (brandId?.startsWith('__new__:')) {
      const brand = await createBrand.mutateAsync({ name: brandId.slice(8) })
      brandId = brand.id
    }

    const product = await createProduct.mutateAsync({
      name,
      brand_id: brandId,
      model_number: productDraft.modelNumber.trim() || undefined,
      category: productDraft.category || undefined,
      region_id: productDraft.regionId || undefined,
    })
    createdProductIdRef.current = product.id

    if (coverFile) {
      const uploaded = await uploadImageFiles('product', [coverFile], getPresignedUrl.mutateAsync)
      const keys = uploaded.flatMap((img) => [img.r2Key, img.thumbnailR2Key].filter(Boolean) as string[])
      try {
        await confirmProductImages.mutateAsync({
          product_id: product.id,
          images: uploaded.map((img, i) => ({
            r2_key: img.r2Key,
            url: img.url,
            thumbnail_r2_key: img.thumbnailR2Key ?? img.r2Key,
            thumbnail_url: img.thumbnailUrl ?? img.url,
            sort_order: i,
          })),
        })
      } catch (err) {
        await deleteObjects.mutateAsync({ r2Keys: keys }).catch(() => {})
        throw err
      }
    }

    return product.id
  }

  // ── Step: 搜尋商品 ──
  if (!selected && creatingName === null) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 md:space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-[17px] font-bold font-heading md:text-2xl">選擇或新增商品</h1>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            請先搜尋想要代購的商品。若清單中已收錄相同商品，建議直接選用以免重複；若沒有，點「沒有我的商品」即可直接填寫代購。
          </p>
        </div>
        <ProductSearch
          onSelect={handleSelectExisting}
          onCreateNew={handleCreateNew}
          createButtonLabel="沒有我的商品"
        />
      </div>
    )
  }

  const isNew = !selected
  const productInfoSlot = isNew ? (
    <ProductInfoFields value={productDraft} onChange={setProductDraft} nameError={productNameError} />
  ) : (
    <div>
      <div className="w-full max-w-sm">
        <ProductCard
          product={{
            id: selected!.id ?? 'selected-product',
            name: selected!.name,
            brand: selected!.brand_name,
            model_number: selected!.model_number,
            catalog_image_url: selected!.catalog_image_url,
          }}
          linkToProduct={false}
          variant="compact"
          className="w-full"
        />
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={backToSearch} className="mt-2 w-full">
        重新選擇
      </Button>
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3 mb-4 md:mb-6 md:block md:relative">
        <Button type="button" variant="ghost" size="icon-sm" onClick={backToSearch} className="md:absolute md:right-full md:inset-y-0 md:my-auto md:mr-1">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-[17px] font-bold font-heading md:text-2xl">填寫代購資訊</h1>
      </div>
      <Card className="ring-0 shadow-sm py-0">
        <CardContent className="p-4 sm:p-8">
          <ListingForm
            productId={selected?.id}
            mode="create"
            onCreateProduct={isNew ? createProductForListing : undefined}
            productInfoSlot={productInfoSlot}
          />
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: 型別檢查與 Lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 無錯誤。注意 `useDeferredProductCreate` 與 `ProductForm` 不再被本頁引用；`ProductForm` / `ProductPicker` 仍被編輯頁與許願頁使用，保留不動。若 lint 對 `lib/hooks/use-deferred-product-create.ts` 報「未使用」，忽略即可（本計畫不刪該檔）。

- [ ] **Step 3: 更新 e2e 測試為新流程**

把 `tests/seller-create.spec.ts` 內第一個測試（`賣家透過 UI 新增代購（含新增商品）...`，約第 20-88 行）整段替換為：

```ts
test('賣家透過 UI 新增代購（含新增商品）→ 直接上架為 active', async ({ sellerPage }) => {
  const productName = e2eName('商品')
  const listingTitle = e2eName('代購')

  await sellerPage.goto('/dashboard/listings/new')
  await sellerPage.waitForTimeout(1000)

  // ── 搜尋 → 點「沒有我的商品」直接進代購表單 ──
  await sellerPage.getByPlaceholder('搜尋商品名稱...').fill(productName)
  await sellerPage.waitForTimeout(1000)
  await sellerPage.getByRole('button', { name: '沒有我的商品' }).click()

  // ── 單一代購表單 ──
  await expect(sellerPage.getByPlaceholder('輸入標題')).toBeVisible({ timeout: 15000 })
  // 代購標題（必填）
  await sellerPage.getByPlaceholder('輸入標題').fill(listingTitle)
  // 代購圖片（必填，整頁唯一的上傳處）
  await sellerPage.locator('input[type="file"]').setInputFiles(TEST_IMAGE)
  await sellerPage.waitForTimeout(1000)
  // 價格（必填）
  await sellerPage.getByPlaceholder('輸入價格').fill('888')

  // ── 商品資訊（位於價格與規格之間）──
  // 商品名稱（必填，已由搜尋預填，再次確認）
  await sellerPage.getByPlaceholder('輸入商品名稱').fill(productName)
  // 品牌（選填，即時新增）
  await sellerPage.getByRole('button', { name: /選擇.*品牌/ }).click()
  await sellerPage.getByPlaceholder('搜尋或輸入品牌名稱...').fill('[E2E] 品牌')
  await sellerPage.waitForTimeout(500)
  await sellerPage.getByRole('option', { name: /新增品牌/ }).click()
  await sellerPage.waitForTimeout(500)
  // 型號（選填）
  await sellerPage.getByPlaceholder('輸入型號').fill('E2E-001')
  // 分類（選填）
  await sellerPage.getByRole('combobox').click()
  await sellerPage.getByRole('option', { name: '美妝保養' }).click()
  // 商品國家（選填）
  await sellerPage.getByRole('button', { name: '選擇國家' }).click()
  await sellerPage.getByRole('option').first().click()

  // ── 出貨/連結/說明 ──
  await pickDate(sellerPage, '選擇預計出貨日期', 25)
  await sellerPage.getByPlaceholder('補充說明...').fill('[E2E] 測試代購說明')
  await sellerPage.getByPlaceholder(/instagram/).fill('https://www.instagram.com/p/e2e-test')
  // 等待非同步處理（圖片壓縮、URL 安全檢查）
  await sellerPage.waitForTimeout(10000)
  await sellerPage.getByRole('button', { name: '直接上架' }).click()

  // ── 驗證：代購已上架並可被搜尋到 ──
  await sellerPage.waitForURL('**/dashboard/listings', { timeout: 30000 })
  await sellerPage.goto(`/search?q=${encodeURIComponent(listingTitle)}`)
  await expect(sellerPage.getByText(listingTitle)).toBeVisible({ timeout: 20000 })

  // ── 驗證：商品已建立且有代表圖（catalog_image_id 已回填）──
  await expect
    .poll(
      async () => {
        const { data } = await dbAdmin()
          .from('products')
          .select('catalog_image_id')
          .like('name', `${productName}%`)
          .maybeSingle()
        return data?.catalog_image_id
      },
      { timeout: 20000 },
    )
    .not.toBeNull()
})
```

- [ ] **Step 4: 跑 e2e 測試**

Run: `npm test -- seller-create.spec.ts`
Expected: 兩個測試皆 PASS（第一個為新流程；第二個「新增連線」未受影響）。
注意：Playwright 需既有測試環境（`tests/fixtures.ts` 的 `sellerPage` 登入態與測試資料庫）。若本機未設定，請依專案既有方式啟動測試堆疊後再跑。

- [ ] **Step 5: 手動驗證兩條路徑**

啟動 `npm run dev`，以賣家身分到 `/dashboard/listings/new`：
1. 搜尋既有商品 → 點選 → 確認表單中間「商品資訊」顯示該商品卡片與「重新選擇」；填完上架成功，商品頁該商品多一位賣家。
2. 搜尋不存在的字 → 點「沒有我的商品」→ 確認直接進代購表單、「商品資訊」為可填欄位且商品名稱已預填搜尋字；整頁只有一個圖片上傳處；上架成功後，買家商品頁/搜尋可見該商品且有圖。
Expected: 兩條路徑皆如上；過程中沒有第二個官方商品圖上傳處。

- [ ] **Step 6: Commit**

```bash
git add app/(seller)/dashboard/listings/new/page.tsx tests/seller-create.spec.ts
git commit -m "feat(listing): 新增代購改為單表單流程（沒有我的商品直接填寫）"
```

---

## Self-Review

**1. Spec coverage**
- 保留選商品、按鈕改「沒有我的商品」→ Task 1 + Task 4。
- 找不到→直接進代購表單、商品名稱帶入搜尋字 → Task 4（`handleCreateNew` 帶入 name、`ProductInfoFields` 顯示可填欄位）。
- 選既有→顯示商品卡片 → Task 4（`productInfoSlot` 卡片分支）。
- 表單欄位順序、商品資訊置於價格與規格之間 → Task 3。
- 只有一套圖、移除官方商品圖 → Task 4（無商品圖上傳；`ProductInfoFields` 無圖片）。
- 背後：選既有掛既有 product_id；新增於送出建立商品 → Task 4（`onCreateProduct` 僅在 `isNew` 提供）。
- 代表圖＝第一張代購圖以 product 用途上傳一份 → Task 3（傳 `pendingFiles[0]`）+ Task 4（`createProductForListing` 上傳 + `confirmProductImages`）。
- 痛點二不處理（兩個名稱欄並存）→ 代購標題仍在 `ListingForm`，商品名稱在 `ProductInfoFields`，無預填/選填變更。
- 不破壞 ProductPicker（編輯/許願）→ 本頁改用 `ProductSearch`，未改 `ProductPicker`。
- 不改資料庫/不做 AI/合併 → 計畫無 migration、無新後端邏輯（僅沿用既有 mutation）。

**2. Placeholder scan**：無 TBD/TODO；每個改動皆附完整程式碼與確切位置。

**3. Type consistency**：`ProductInfoData`（含 `brand_id` 原始值）於 Task 2 定義、Task 4 使用一致；`onCreateProduct(coverFile: File | null) => Promise<string>` 於 Task 3 定義、Task 4 之 `createProductForListing` 相符；`productInfoSlot: ReactNode` 於 Task 3 定義、Task 4 傳入相符；`confirmProductImages` 入參 shape 與 `server/routers/upload.ts` 相符。

## 已知取捨（實作者須知）

- 新增商品時，第一張圖會被上傳兩次（一次 `listing`、一次 `product`），等於同圖在 R2 存兩份。這是為了符合「商品圖只收 product 路徑金鑰」的安全限制，屬可接受小成本。
- 若建立商品成功、後續代購建立失敗，`ListingForm` 既有回滾會清掉代購與其圖，但**不會**回滾已建立的商品與其代表圖（沿用既有 deferred 行為，非本次回歸）。`createdProductIdRef` 確保重試不重複建立商品。
- 草稿（存草稿）仍會建立商品（`listings.product_id` 必填，本期不改 schema）。
