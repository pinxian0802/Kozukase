# 許願榜改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把許願榜從商品排行重設計為個人許願表單流程，公開頁改成需求牆（最新在前），並在收藏頁加入許願管理 tab。

**Architecture:** 許願改為表單驅動，填表 → 自動建商品目錄 + 許願記錄，合併去重由管理員在後台處理。後端新增 `wish.create`、`wish.delete`、`wish.publicFeed` 三支 API，移除 `wish.toggle`。

**Tech Stack:** Next.js 15 App Router, tRPC, Supabase（PostgreSQL + RLS）, Tailwind CSS, shadcn/ui

---

## File Map

| 狀態 | 檔案 | 負責的事 |
|------|------|---------|
| 新增 | `supabase/migrations/00045_add_wish_content.sql` | DB migration：wishes 加 content 欄位 |
| 修改 | `server/routers/wish.ts` | 移除 toggle，加 create / delete / publicFeed，更新 myWishes |
| 新增 | `components/buyer/wish-form.tsx` | 許願專屬表單元件（圖片/名稱/品牌/型號/國家/許願內容） |
| 修改 | `app/(buyer)/wishes/new/page.tsx` | 換用 WishForm，移除確認 Dialog |
| 新增 | `components/buyer/wish-card.tsx` | 公開許願榜的單張卡片（商品資訊 + 許願內容 + 許願者頭貼） |
| 修改 | `app/(buyer)/wishes/page.tsx` | 換用 publicFeed API + WishCard |
| 修改 | `app/(buyer)/products/[id]/page-client.tsx` | 移除許願按鈕與相關邏輯 |
| 修改 | `app/(user)/favorites/page.tsx` | 新增許願 tab |
| 修改 | `components/buyer/skeletons/wishes-list-skeleton.tsx` | 骨架改為 feed 樣式 |

---

## Task 1：DB Migration

**Files:**
- 新增：`supabase/migrations/00045_add_wish_content.sql`

- [ ] **Step 1：建立 migration 檔**

新增檔案 `supabase/migrations/00045_add_wish_content.sql`，內容如下：

```sql
-- 許願表加入 content 欄位（許願內容說明）
ALTER TABLE wishes ADD COLUMN content text NOT NULL DEFAULT '';
ALTER TABLE wishes ALTER COLUMN content DROP DEFAULT;
```

- [ ] **Step 2：套用 migration 到本地 Supabase**

```powershell
npx supabase db push
```

預期輸出包含：`Applying migration 00045_add_wish_content.sql`

- [ ] **Step 3：確認欄位存在**

在 Supabase Studio（http://localhost:54323）查看 `wishes` 表，確認有 `content text` 欄位。

- [ ] **Step 4：Commit**

```powershell
git add supabase/migrations/00045_add_wish_content.sql
git commit -m "feat: add content column to wishes table"
```

---

## Task 2：更新 wish router

**Files:**
- 修改：`server/routers/wish.ts`

- [ ] **Step 1：完整替換 `server/routers/wish.ts`**

```typescript
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { decodeCursor, paginateResults } from '@/lib/utils/pagination'

export const wishRouter = router({
  create: protectedProcedure
    .input(z.object({
      product_id: z.string().uuid(),
      content: z.string().min(1, '請填寫許願內容'),
    }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.db
        .from('wishes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', ctx.user.id)

      if ((count ?? 0) >= 20) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '許願數量已達上限（20 個）' })
      }

      const { error } = await ctx.db.from('wishes').insert({
        user_id: ctx.user.id,
        product_id: input.product_id,
        content: input.content,
      })
      if (error) throw error
      return { wished: true }
    }),

  delete: protectedProcedure
    .input(z.object({ product_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.db
        .from('wishes')
        .delete()
        .eq('user_id', ctx.user.id)
        .eq('product_id', input.product_id)

      if (error) throw error
      return { wished: false }
    }),

  myWishes: protectedProcedure
    .input(z.object({
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('wishes')
        .select(`
          id, created_at, content,
          product:products(
            id, name, brand:brands(name), model_number, category, wish_count,
            catalog_image:product_images!fk_catalog_image(id, url, r2_key, thumbnail_url, thumbnail_r2_key),
            product_images:product_images!product_images_product_id_fkey(id, url, r2_key, thumbnail_url, thumbnail_r2_key)
          )
        `)
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false })

      if (input.cursor) {
        const { sortValue } = decodeCursor(input.cursor)
        if (sortValue) query = query.lt('created_at', sortValue)
      }

      query = query.limit(input.limit + 1)
      const { data, error } = await query
      if (error) throw error
      return paginateResults(data ?? [], input.limit, (item) => item.created_at)
    }),

  publicFeed: publicProcedure
    .input(z.object({
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('wishes')
        .select(`
          id, created_at, content,
          product:products(
            id, name, brand:brands(name), model_number,
            catalog_image:product_images!fk_catalog_image(id, url, thumbnail_url)
          ),
          profile:profiles(display_name, avatar_url)
        `)
        .order('created_at', { ascending: false })

      if (input.cursor) {
        const { sortValue } = decodeCursor(input.cursor)
        if (sortValue) query = query.lt('created_at', sortValue)
      }

      query = query.limit(input.limit + 1)
      const { data, error } = await query
      if (error) throw error
      return paginateResults(data ?? [], input.limit, (item) => item.created_at)
    }),

  // 保留備用（後台排行或未來功能）
  topWished: publicProcedure
    .input(z.object({
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('products')
        .select(`
          id, name, brand:brands(name), model_number, category, wish_count,
          catalog_image:product_images!fk_catalog_image(id, url, r2_key, thumbnail_url, thumbnail_r2_key),
          product_images:product_images!product_images_product_id_fkey(id, url, r2_key, thumbnail_url, thumbnail_r2_key)
        `)
        .eq('is_removed', false)
        .gt('wish_count', 0)
        .order('wish_count', { ascending: false })
        .order('id', { ascending: false })

      if (input.cursor) {
        const { id, sortValue } = decodeCursor(input.cursor)
        if (sortValue !== undefined) {
          query = query.or(
            `wish_count.lt.${sortValue},and(wish_count.eq.${sortValue},id.lt.${id})`
          )
        }
      }

      query = query.limit(input.limit + 1)
      const { data, error } = await query
      if (error) throw error
      return paginateResults(data ?? [], input.limit, (item) => item.wish_count)
    }),
})
```

- [ ] **Step 2：TypeScript 型別檢查**

```powershell
npx tsc --noEmit
```

確認無 error（警告可暫忽略）。

- [ ] **Step 3：Commit**

```powershell
git add server/routers/wish.ts
git commit -m "feat: replace wish.toggle with wish.create/delete, add publicFeed, update myWishes"
```

---

## Task 3：新增 WishForm 元件

**Files:**
- 新增：`components/buyer/wish-form.tsx`

- [ ] **Step 1：建立 `components/buyer/wish-form.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { SingleImageUpload } from '@/components/shared/single-image-upload'
import { FormFieldError } from '@/components/shared/form-field-error'
import { BrandSelect } from '@/components/shared/brand-select'
import { scrollToFirstError } from '@/lib/utils/scroll-to-error'
import { trpc } from '@/lib/trpc/client'

export interface WishFormData {
  name: string
  brand_id: string | undefined
  modelNumber: string
  regionId: string
  content: string
  pendingFile: File | null
}

interface WishFormProps {
  onBack: () => void
  onSubmit: (data: WishFormData) => void
  isSubmitting?: boolean
}

export function WishForm({ onBack, onSubmit, isSubmitting }: WishFormProps) {
  const [name, setName] = useState('')
  const [brandId, setBrandId] = useState('none')
  const [modelNumber, setModelNumber] = useState('')
  const [regionId, setRegionId] = useState('')
  const [content, setContent] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const [nameError, setNameError] = useState('')
  const [imageError, setImageError] = useState('')
  const [regionError, setRegionError] = useState('')
  const [contentError, setContentError] = useState('')

  const { data: regions } = trpc.seller.getRegions.useQuery()

  const handleSubmit = () => {
    let hasError = false

    if (!pendingFile) {
      setImageError('商品圖片為必填')
      hasError = true
    } else {
      setImageError('')
    }

    if (!name.trim()) {
      setNameError('商品名稱為必填')
      hasError = true
    } else {
      setNameError('')
    }

    if (!regionId) {
      setRegionError('請選擇國家')
      hasError = true
    } else {
      setRegionError('')
    }

    if (!content.trim()) {
      setContentError('請填寫許願內容')
      hasError = true
    } else {
      setContentError('')
    }

    if (hasError) {
      scrollToFirstError()
      return
    }

    onSubmit({
      name: name.trim(),
      brand_id: brandId === 'none' ? undefined : brandId,
      modelNumber,
      regionId,
      content: content.trim(),
      pendingFile,
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold font-heading">新增許願</h1>
      </div>

      <div className="space-y-5">
        <div>
          <Label>商品圖片 <span className="text-foreground">*</span></Label>
          <p className="text-[11px] text-muted-foreground mt-0.5">建議 800×800 px 以上，正方形</p>
          <div className="mt-1.5">
            <SingleImageUpload
              purpose="product"
              value={null}
              onChange={() => {}}
              pendingFile={pendingFile}
              onPendingFileChange={(file) => {
                setPendingFile(file)
                if (file && imageError) setImageError('')
              }}
              invalid={!!imageError}
            />
          </div>
          <FormFieldError message={imageError} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="wish-name">商品名稱 <span className="text-foreground">*</span></Label>
          <Input
            id="wish-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (nameError) setNameError('')
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
            placeholder="輸入商品名稱"
            aria-invalid={!!nameError}
          />
          <FormFieldError message={nameError} />
        </div>

        <div className="space-y-1.5">
          <Label>品牌</Label>
          <BrandSelect
            value={brandId}
            onValueChange={setBrandId}
            placeholder="選擇或新增品牌"
            deferred
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="wish-model">型號</Label>
          <Input
            id="wish-model"
            value={modelNumber}
            onChange={(e) => setModelNumber(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
            placeholder="輸入型號"
          />
        </div>

        <div className="space-y-1.5">
          <Label>國家 <span className="text-foreground">*</span></Label>
          <SearchableSelect
            value={regionId}
            onValueChange={(v) => {
              setRegionId(v)
              if (regionError) setRegionError('')
            }}
            options={(regions ?? []).map((r: { id: string; name: string }) => ({ value: r.id, label: r.name }))}
            placeholder="選擇國家"
            searchPlaceholder="搜尋國家..."
            emptyText="找不到相符的國家"
          />
          <FormFieldError message={regionError} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="wish-content">許願內容 <span className="text-foreground">*</span></Label>
          <Textarea
            id="wish-content"
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              if (contentError) setContentError('')
            }}
            placeholder="描述你希望代購的細節，例如顏色、尺寸、版本..."
            rows={4}
            aria-invalid={!!contentError}
          />
          <FormFieldError message={contentError} />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onBack}>
            取消
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? '處理中...' : '送出許願'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2：TypeScript 型別檢查**

```powershell
npx tsc --noEmit
```

確認無 error。

- [ ] **Step 3：Commit**

```powershell
git add components/buyer/wish-form.tsx
git commit -m "feat: add WishForm component"
```

---

## Task 4：更新 `/wishes/new` 頁面

**Files:**
- 修改：`app/(buyer)/wishes/new/page.tsx`

- [ ] **Step 1：完整替換 `app/(buyer)/wishes/new/page.tsx`**

```typescript
'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { WishForm, type WishFormData } from '@/components/buyer/wish-form'
import { uploadImageFiles } from '@/components/shared/image-upload'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'

export default function WishNewPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const createdProductIdRef = useRef<string | null>(null)

  const createProduct = trpc.product.create.useMutation()
  const createBrand = trpc.brand.create.useMutation()
  const wishCreate = trpc.wish.create.useMutation()
  const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation()
  const confirmProductImage = trpc.upload.confirmProductImage.useMutation()
  const deleteObjects = trpc.upload.deleteObjects.useMutation()

  const handleSubmit = async (data: WishFormData) => {
    setIsSubmitting(true)
    try {
      let productId = createdProductIdRef.current

      if (!productId) {
        let resolvedBrandId = data.brand_id
        if (resolvedBrandId?.startsWith('__new__:')) {
          const brand = await createBrand.mutateAsync({ name: resolvedBrandId.slice(8) })
          resolvedBrandId = brand.id
        }

        const product = await createProduct.mutateAsync({
          name: data.name,
          brand_id: resolvedBrandId || undefined,
          model_number: data.modelNumber.trim() || undefined,
          region_id: data.regionId || undefined,
        })
        productId = product.id as string
        createdProductIdRef.current = productId

        if (data.pendingFile) {
          const uploaded = await uploadImageFiles('product', [data.pendingFile], getPresignedUrl.mutateAsync)
          if (uploaded[0]) {
            try {
              await confirmProductImage.mutateAsync({
                product_id: productId,
                r2_key: uploaded[0].r2Key,
                url: uploaded[0].url,
                thumbnail_r2_key: uploaded[0].thumbnailR2Key ?? uploaded[0].r2Key,
                thumbnail_url: uploaded[0].thumbnailUrl ?? uploaded[0].url,
              })
            } catch {
              await deleteObjects.mutateAsync({
                r2Keys: [uploaded[0].r2Key, uploaded[0].thumbnailR2Key].filter(Boolean) as string[],
              }).catch(() => {})
              throw new Error('圖片上傳失敗，請重試')
            }
          }
        }
      }

      await wishCreate.mutateAsync({
        product_id: productId!,
        content: data.content,
      })

      toast.success('許願已送出')
      router.push('/wishes')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '送出失敗，請重試'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <WishForm
        onBack={() => router.back()}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
```

- [ ] **Step 2：更新 WishFormSkeleton 標題**

開啟 `components/buyer/skeletons/wish-form-skeleton.tsx`，把第 7 行的 `px-4 py-6` 確認已存在（已有，不需改）。

- [ ] **Step 3：手動測試流程**

啟動開發伺服器，登入後前往 `/wishes/new`：
- 確認表單有 6 個欄位（圖片、名稱、品牌、型號、國家、許願內容）
- 必填欄位空白送出應顯示紅字錯誤
- 填完所有必填欄位送出，應跳至 `/wishes` 並顯示 toast「許願已送出」
- 在 Supabase Studio 的 `wishes` 表確認新記錄有 `content` 值

- [ ] **Step 4：Commit**

```powershell
git add app/(buyer)/wishes/new/page.tsx
git commit -m "feat: update wish new page to use WishForm, remove confirm dialog"
```

---

## Task 5：新增 WishCard 元件

**Files:**
- 新增：`components/buyer/wish-card.tsx`

- [ ] **Step 1：建立 `components/buyer/wish-card.tsx`**

```typescript
import Image from 'next/image'
import { Package } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getCardImageUrl } from '@/lib/utils/image-variants.mjs'

export type WishCardWish = {
  id: string
  content: string
  created_at: string
  product: {
    id: string
    name: string
    brand?: { name: string } | string | null
    model_number?: string | null
    catalog_image?: { url: string; thumbnail_url?: string | null } | null
  } | null
  profile: {
    display_name: string | null
    avatar_url: string | null
  } | null
}

export function WishCard({ wish }: { wish: WishCardWish }) {
  if (!wish.product) return null

  const imageUrl = getCardImageUrl(wish.product as any)
  const brandLabel = typeof wish.product.brand === 'string'
    ? wish.product.brand
    : wish.product.brand?.name ?? null
  const displayName = wish.profile?.display_name ?? '匿名'

  return (
    <div className="overflow-hidden rounded-2xl border border-border-soft bg-surface-card shadow-sm">
      {/* 商品圖片 */}
      <div className="relative aspect-square bg-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={wish.product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/30">
            <Package className="h-7 w-7" />
          </div>
        )}
      </div>

      {/* 內容 */}
      <div className="p-4 space-y-2">
        {brandLabel && (
          <p className="truncate text-xs text-muted-foreground">{brandLabel}</p>
        )}
        <p className="font-bold leading-snug line-clamp-2 text-foreground">
          {wish.product.name}
        </p>
        <p className="text-sm text-muted-foreground line-clamp-2">{wish.content}</p>

        {/* 許願者 */}
        <div className="flex items-center gap-2 pt-1">
          <Avatar className="h-6 w-6">
            <AvatarImage src={wish.profile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-[10px]">{displayName[0]}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">{displayName}</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2：TypeScript 型別檢查**

```powershell
npx tsc --noEmit
```

確認無 error。

- [ ] **Step 3：Commit**

```powershell
git add components/buyer/wish-card.tsx
git commit -m "feat: add WishCard component for public feed"
```

---

## Task 6：更新公開許願榜頁面

**Files:**
- 修改：`app/(buyer)/wishes/page.tsx`
- 修改：`components/buyer/skeletons/wishes-list-skeleton.tsx`

- [ ] **Step 1：完整替換 `app/(buyer)/wishes/page.tsx`**

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { Heart, Plus } from 'lucide-react'
import { WishCard } from '@/components/buyer/wish-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { trpc } from '@/lib/trpc/client'
import { useSession } from '@/lib/context/session-context'

export default function WishesPage() {
  const router = useRouter()
  const session = useSession()

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.wish.publicFeed.useInfiniteQuery(
      { limit: 20 },
      { getNextPageParam: (lastPage: any) => lastPage.nextCursor }
    )

  const wishes = data?.pages.flatMap((p: any) => p.items) ?? []

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading mb-2">許願榜</h1>
          <p className="text-muted-foreground">
            大家最想代購的商品，一起許願讓更多賣家看見
          </p>
        </div>
        {session && (
          <Button onClick={() => router.push('/wishes/new')} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            新增許願
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      ) : wishes.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {wishes.map((wish: any) => (
              <WishCard key={wish.id} wish={wish} />
            ))}
          </div>
          {hasNextPage && (
            <div className="mt-8 text-center">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? '載入中...' : '載入更多'}
              </Button>
            </div>
          )}
        </>
      ) : (
        <EmptyState icon={Heart} title="還沒有人許願" description="先去新增你想要的商品吧！" />
      )}
    </div>
  )
}
```

- [ ] **Step 2：更新 `components/buyer/skeletons/wishes-list-skeleton.tsx`**

骨架卡片改用 `aspect-[3/4]` 對應新 WishCard 的高度：

```typescript
import { Skeleton } from '@/components/ui/skeleton'

export function WishesListSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-28 shrink-0 rounded-md" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3：手動確認頁面**

前往 `/wishes`，確認：
- 顯示 WishCard 格狀 feed（最新在前）
- 每張卡有圖片、商品名稱、許願內容、頭貼＋名稱
- 未登入也能看到內容（publicFeed 為 public）

- [ ] **Step 4：Commit**

```powershell
git add app/(buyer)/wishes/page.tsx components/buyer/skeletons/wishes-list-skeleton.tsx
git commit -m "feat: update wish board to public feed with WishCard"
```

---

## Task 7：移除商品頁許願按鈕

**Files:**
- 修改：`app/(buyer)/products/[id]/page-client.tsx`

- [ ] **Step 1：移除許願相關 import 與邏輯**

開啟 `app/(buyer)/products/[id]/page-client.tsx`。

移除這一行 import（若 `Heart` 只用在許願按鈕）：
```typescript
import { Heart, Bookmark, SlidersHorizontal, X, PackageOpen } from 'lucide-react'
```
改為：
```typescript
import { Bookmark, SlidersHorizontal, X, PackageOpen } from 'lucide-react'
```

- [ ] **Step 2：移除 wishToggle mutation**

刪除以下整段（約第 55–69 行）：
```typescript
const wishToggle = trpc.wish.toggle.useMutation({
  onMutate: async () => {
    await utils.product.getById.cancel({ id })
    const prev = utils.product.getById.getData({ id })
    if (prev) {
      utils.product.getById.setData({ id }, { ...prev, hasWished: !prev.hasWished })
    }
    return { prev }
  },
  onError: (err, _vars, context) => {
    if (context?.prev) utils.product.getById.setData({ id }, context.prev)
    toast.error(err.message)
  },
  onSettled: () => utils.product.getById.invalidate({ id }),
})
```

- [ ] **Step 3：移除許願按鈕 JSX**

刪除以下 JSX（約第 229–237 行）：
```typescript
<Button
  variant={product.hasWished ? 'default' : 'outline'}
  className="flex-1 min-w-0"
  onClick={() => wishToggle.mutate({ product_id: id })}
  disabled={wishToggle.isPending}
>
  <Heart className={`mr-2 h-4 w-4 shrink-0 ${product.hasWished ? 'fill-current' : ''}`} />
  許願
</Button>
```

收藏按鈕由 `flex-1` 變成獨占整行，移除 `flex gap-2` wrapper 或維持現狀（兩個 button 的 wrapper）：

若 wrapper 是：
```typescript
<div className="flex gap-2 pt-1">
```
現在只剩收藏按鈕，可以把 wrapper 保留（一個 button 也沒問題），或直接拿掉 wrapper。

- [ ] **Step 4：TypeScript 型別檢查**

```powershell
npx tsc --noEmit
```

確認無 error。

- [ ] **Step 5：手動確認**

前往任一商品詳情頁，確認：
- 左側卡片只剩「收藏」按鈕，沒有「許願」按鈕

- [ ] **Step 6：Commit**

```powershell
git add "app/(buyer)/products/[id]/page-client.tsx"
git commit -m "feat: remove wish button from product detail page"
```

---

## Task 8：收藏頁新增許願 tab

**Files:**
- 修改：`app/(user)/favorites/page.tsx`

- [ ] **Step 1：完整替換 `app/(user)/favorites/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { Bookmark, Heart } from 'lucide-react'
import { ProductCard } from '@/components/product/product-card'
import { ListingCard } from '@/components/listing/listing-card'
import { ConnectionCard } from '@/components/connection/connection-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { trpc } from '@/lib/trpc/client'
import { useSession } from '@/lib/context/session-context'
import { toast } from 'sonner'
import { getCardImageUrl } from '@/lib/utils/image-variants.mjs'

type BookmarkFilter = 'all' | 'product' | 'listing' | 'connection' | 'wish'

export default function FavoritesPage() {
  const session = useSession()
  const [filter, setFilter] = useState<BookmarkFilter>('all')
  const utils = trpc.useUtils()

  const { data: productBookmarks } = trpc.bookmark.myProductBookmarks.useQuery({ limit: 50 })
  const { data: listingBookmarks } = trpc.bookmark.myListingBookmarks.useQuery({ limit: 50 })
  const { data: connectionBookmarks } = trpc.bookmark.myConnectionBookmarks.useQuery({ limit: 50 })
  const { data: myWishes } = trpc.wish.myWishes.useQuery({ limit: 50 })

  const wishDelete = trpc.wish.delete.useMutation({
    onSuccess: () => {
      toast.success('已取消許願')
      utils.wish.myWishes.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  if (!session?.profile) return null

  const tabs: { key: BookmarkFilter; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'product', label: '商品' },
    { key: 'listing', label: '代購' },
    { key: 'connection', label: '連線' },
    { key: 'wish', label: '許願' },
  ]

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold font-heading">我的收藏</h1>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
              filter === key
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-brand-50 hover:text-brand-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 商品 */}
      {(filter === 'all' || filter === 'product') && (
        <div>
          {filter === 'all' && (
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">商品</h3>
          )}
          {productBookmarks?.items && productBookmarks.items.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {productBookmarks.items.map((b: any) => (
                <ProductCard key={b.id} product={b.product} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Bookmark} title="還沒有收藏的商品" />
          )}
        </div>
      )}

      {/* 代購 */}
      {(filter === 'all' || filter === 'listing') && (
        <div>
          {filter === 'all' && (
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">代購</h3>
          )}
          {listingBookmarks?.items && listingBookmarks.items.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {listingBookmarks.items.map((b: any) => (
                <ListingCard key={b.id} listing={b.listing} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Bookmark} title="還沒有收藏的代購" />
          )}
        </div>
      )}

      {/* 連線 */}
      {(filter === 'all' || filter === 'connection') && (
        <div>
          {filter === 'all' && (
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">連線</h3>
          )}
          {connectionBookmarks?.items && connectionBookmarks.items.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {connectionBookmarks.items.map((b: any) => (
                <ConnectionCard key={b.id} connection={b.connection} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Bookmark} title="還沒有收藏的連線" />
          )}
        </div>
      )}

      {/* 許願 */}
      {(filter === 'all' || filter === 'wish') && (
        <div>
          {filter === 'all' && (
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">許願</h3>
          )}
          {myWishes?.items && myWishes.items.length > 0 ? (
            <div className="space-y-3">
              {myWishes.items.map((wish: any) => {
                const imageUrl = getCardImageUrl(wish.product as any)
                return (
                  <div key={wish.id} className="flex items-start gap-4 rounded-2xl border border-border-soft bg-surface-card p-4">
                    {/* 縮圖 */}
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                      {imageUrl ? (
                        <img src={imageUrl} alt={wish.product?.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground/30 text-xs">無圖</div>
                      )}
                    </div>

                    {/* 資訊 */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-semibold truncate">{wish.product?.name}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{wish.content}</p>
                    </div>

                    {/* 取消許願 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => { if (wish.product?.id) wishDelete.mutate({ product_id: wish.product.id }) }}
                      disabled={wishDelete.isPending}
                    >
                      取消
                    </Button>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState icon={Heart} title="還沒有許願" description="去許願榜新增你想代購的商品吧！" />
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2：TypeScript 型別檢查**

```powershell
npx tsc --noEmit
```

確認無 error。

- [ ] **Step 3：手動確認**

登入後前往 `/favorites`：
- 確認有「許願」tab
- 點擊「許願」tab 顯示許願清單（縮圖 + 名稱 + 許願內容 + 取消按鈕）
- 點「取消」後該筆許願消失，顯示 toast

- [ ] **Step 4：Commit**

```powershell
git add "app/(user)/favorites/page.tsx"
git commit -m "feat: add wish tab to favorites page"
```

---

## 完成確認清單

- [ ] `wishes` 表有 `content` 欄位
- [ ] `wish.toggle` 已移除，`wish.create` / `wish.delete` 正常運作
- [ ] `wish.publicFeed` 回傳帶 profile 的許願列表
- [ ] `wish.myWishes` 包含 `content` 欄位
- [ ] `/wishes/new` 使用新 WishForm，送出後直接跳 `/wishes`
- [ ] `/wishes` 顯示 WishCard feed，最新在前
- [ ] `/products/[id]` 沒有許願按鈕
- [ ] `/favorites` 有許願 tab，可取消許願
