# Dashboard 表格化重構 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `/dashboard/listings` 與 `/dashboard/connections` 從卡片式 row 改成真正的表格(桌機 7 欄表格、手機 fallback 卡片),只保留重要欄位,並抽出共用元件。

**Architecture:** 桌機使用 shadcn `<Table>`,手機在 `<lg` 斷點切換成卡片清單。Header / Tabs / 狀態小圓點 / Thumbnail (含 lightbox) 抽成 `components/dashboard/` 共用元件。Status 與按鈕邏輯保留在各頁面內。

**Tech Stack:** Next.js App Router、tRPC、TailwindCSS、shadcn/ui、Base UI、lucide-react、sonner。

**Spec:** [docs/superpowers/specs/2026-05-21-dashboard-table-refactor-design.md](../specs/2026-05-21-dashboard-table-refactor-design.md)

**驗證策略(無單元測試框架,以下取代 TDD test-first):**
- `npm run lint` — ESLint
- `npm run build` — TypeScript compile + Next build
- 手動驗證(以 `run` skill 或 `npm run dev` 啟 dev server)
- 既有 Playwright 測試:`npx playwright test tests/seller.spec.ts`(需 env 設好,refactor 不應破壞既有 selector)

**Commit 政策:** 使用者要求不自動 commit。每個任務尾端是 **Checkpoint(請使用者 review)** 而非 git commit。使用者自行決定何時 commit。

---

## File Structure

**新增 (Create):**
- `components/ui/table.tsx` — shadcn Table primitives (官方範本複製)
- `components/dashboard/status-dot.tsx` — `DashboardStatusDot`:狀態圓點 + 文字
- `components/dashboard/thumbnail-cell.tsx` — `DashboardThumbnailCell`:縮圖 + lightbox(取代 `ListingThumbnail`/`ConnectionThumbnail`)
- `components/dashboard/list-shell.tsx` — `DashboardListShell`:Header + Tabs + Skeleton + EmptyState 容器

**修改 (Modify):**
- `app/(seller)/dashboard/listings/page.tsx` — 整頁改寫成 Table + Mobile Card
- `app/(seller)/dashboard/connections/page.tsx` — 整頁改寫成 Table + Mobile Card

---

## Task 1: 新增 shadcn `<Table>` primitive

shadcn Table 是純樣式組件,沒有外部依賴,先加入專案。

**Files:**
- Create: `components/ui/table.tsx`

- [ ] **Step 1: 建立 `components/ui/table.tsx`**

以官方 shadcn table 範本為基礎,使用專案現有的 `cn` utility:

```tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-auto">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  )
}

function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('[&_tr]:border-b', className)} {...props} />
}

function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
}

function TableFooter({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-b transition-colors hover:bg-muted/30 data-[state=selected]:bg-muted',
        className,
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'h-10 px-3 text-left align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('px-3 py-3 align-middle [&:has([role=checkbox])]:pr-0', className)}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return <caption className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
```

- [ ] **Step 2: 確認 lint 過**

Run: `npm run lint`
Expected: 無錯誤

- [ ] **Step 3: Checkpoint — 請使用者 review**

確認 Table primitive 樣式 OK 後再進下一個 task。

---

## Task 2: 建立 `DashboardStatusDot` 元件

最小、無依賴。提供 `label` 跟 `dotClassName`,純展示。

**Files:**
- Create: `components/dashboard/status-dot.tsx`

- [ ] **Step 1: 建立 `components/dashboard/status-dot.tsx`**

```tsx
import { cn } from '@/lib/utils'

export type DashboardStatusDotProps = {
  label: string
  dotClassName?: string
  className?: string
}

export function DashboardStatusDot({ label, dotClassName, className }: DashboardStatusDotProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.16em] text-muted-foreground',
        className,
      )}
    >
      <span className={cn('h-2 w-2 shrink-0 rounded-full bg-gray-400', dotClassName)} />
      {label}
    </span>
  )
}
```

- [ ] **Step 2: lint 過**

Run: `npm run lint`
Expected: 無錯誤

- [ ] **Step 3: Checkpoint — 請使用者 review**

---

## Task 3: 建立 `DashboardThumbnailCell` 元件

整合既有兩頁的 `ListingThumbnail` / `ConnectionThumbnail`,差異化用 `fallbackIcon` prop。

**Files:**
- Create: `components/dashboard/thumbnail-cell.tsx`
- Reference: `components/shared/image-lightbox.tsx`(現有 lightbox 元件)

- [ ] **Step 1: 建立 `components/dashboard/thumbnail-cell.tsx`**

```tsx
'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Images, Maximize2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ImageLightbox } from '@/components/shared/image-lightbox'

export type DashboardThumbnailImage = {
  url: string
  alt?: string
}

export type DashboardThumbnailCellProps = {
  images: DashboardThumbnailImage[]
  title: string
  fallbackIcon: LucideIcon
  /** Thumbnail size in pixels (square). Default 48 for desktop table, 40 for mobile card. */
  size?: number
  className?: string
}

export function DashboardThumbnailCell({
  images,
  title,
  fallbackIcon: FallbackIcon,
  size = 48,
  className,
}: DashboardThumbnailCellProps) {
  const [viewerOpen, setViewerOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const sizeStyle = { width: size, height: size }

  if (images.length === 0) {
    return (
      <div
        style={sizeStyle}
        className={cn(
          'relative shrink-0 overflow-hidden rounded-lg border bg-muted/40',
          className,
        )}
      >
        <div className="flex h-full items-center justify-center text-muted-foreground/50">
          <FallbackIcon className="h-1/2 w-1/2" />
        </div>
      </div>
    )
  }

  const currentIndex = Math.min(activeIndex, Math.max(images.length - 1, 0))
  const activeImage = images[currentIndex] ?? images[0]
  const isLocalPreviewUrl =
    activeImage.url.startsWith('blob:') || activeImage.url.startsWith('data:')

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setViewerOpen(true)
        }}
        style={sizeStyle}
        className={cn(
          'group relative shrink-0 cursor-pointer overflow-hidden rounded-lg border bg-muted/40 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          className,
        )}
        aria-label={`預覽 ${title}`}
      >
        <Image
          src={activeImage.url}
          alt={activeImage.alt ?? title}
          fill
          sizes={`${size}px`}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          unoptimized={isLocalPreviewUrl}
        />
        {images.length > 1 && (
          <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="inline-flex min-w-0 items-center gap-0.5 truncate">
              <Images className="h-3 w-3 shrink-0" />
              {images.length}
            </span>
            <Maximize2 className="h-3 w-3 shrink-0" />
          </div>
        )}
      </button>

      <ImageLightbox
        open={viewerOpen}
        images={images}
        activeIndex={currentIndex}
        onActiveIndexChange={setActiveIndex}
        onOpenChange={setViewerOpen}
      />
    </>
  )
}
```

注意:`onClick` 內部 `e.stopPropagation()` — 避免將來在 `<tr>` 上加 row click 時誤觸發。

- [ ] **Step 2: lint 過**

Run: `npm run lint`
Expected: 無錯誤

- [ ] **Step 3: Checkpoint — 請使用者 review**

---

## Task 4: 建立 `DashboardListShell` 容器

包 Header(標題、計數、新增按鈕)+ Tabs + Loading skeleton + Empty state 的外殼。內部 `children` 由各頁傳入(桌機 Table 或手機 Card 清單)。

**Files:**
- Create: `components/dashboard/list-shell.tsx`
- Reference: `components/shared/filter-tabs-list.tsx`、`components/shared/empty-state.tsx`、`components/ui/skeleton.tsx`、`components/ui/tabs.tsx`、`components/ui/button.tsx`

- [ ] **Step 1: 建立 `components/dashboard/list-shell.tsx`**

```tsx
'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Tabs } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FilterTabsList } from '@/components/shared/filter-tabs-list'
import { EmptyState } from '@/components/shared/empty-state'

export type DashboardListShellTab = {
  value: string
  label: string
  count: number
}

export type DashboardListShellProps = {
  title: string
  usageHint: string
  newButton: {
    href: string
    label: string
  }
  tabs: DashboardListShellTab[]
  currentTab: string
  onTabChange: (value: string) => void
  isLoading: boolean
  isEmpty: boolean
  emptyState: {
    icon: LucideIcon
    title: string
    description: string
  }
  children: ReactNode
}

export function DashboardListShell({
  title,
  usageHint,
  newButton,
  tabs,
  currentTab,
  onTabChange,
  isLoading,
  isEmpty,
  emptyState,
  children,
}: DashboardListShellProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">{title}</h1>
          <p className="text-sm text-muted-foreground">{usageHint}</p>
        </div>
        <Button render={<Link href={newButton.href} />}>
          <Plus className="mr-1 h-4 w-4" />
          {newButton.label}
        </Button>
      </div>

      <Tabs value={currentTab} onValueChange={onTabChange}>
        <FilterTabsList items={tabs} />
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={emptyState.icon}
          title={emptyState.title}
          description={emptyState.description}
        />
      ) : (
        children
      )}
    </div>
  )
}
```

- [ ] **Step 2: lint 過**

Run: `npm run lint`
Expected: 無錯誤

- [ ] **Step 3: Checkpoint — 請使用者 review**

---

## Task 5: Refactor `app/(seller)/dashboard/listings/page.tsx`

把卡片 row 整頁改成桌機 Table + 手機 Card。

**Files:**
- Modify: `app/(seller)/dashboard/listings/page.tsx`(整個 component 重寫)
- Reference: 現有 `app/(seller)/dashboard/listings/page.tsx` 第 130-145 行(tRPC mutations 邏輯保留)、第 19-31 行(statusLabels / statusDotColors 保留)

- [ ] **Step 1: 整頁改寫**

新檔案內容:

```tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ExternalLink, Package, Stamp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DashboardListShell } from '@/components/dashboard/list-shell'
import { DashboardStatusDot } from '@/components/dashboard/status-dot'
import { DashboardThumbnailCell, type DashboardThumbnailImage } from '@/components/dashboard/thumbnail-cell'
import { SafeExternalLink } from '@/components/shared/safe-external-link'
import { trpc } from '@/lib/trpc/client'
import { formatPrice, formatDate } from '@/lib/utils/format'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

const statusLabels: Record<string, string> = {
  draft: '草稿',
  active: '上架中',
  inactive: '已下架',
  pending_approval: '待審核',
}

const statusDotColors: Record<string, string> = {
  draft: 'bg-yellow-400',
  active: 'bg-green-500',
  inactive: 'bg-gray-400',
  pending_approval: 'bg-red-500',
}

type ListingStatus = 'draft' | 'active' | 'inactive' | 'pending_approval'

export default function SellerListingsPage() {
  const router = useRouter()
  const [status, setStatus] = useState<string>('all')
  const utils = trpc.useUtils()
  const { data: counts } = trpc.listing.myListingCount.useQuery()

  const statusFilter = status === 'all' ? undefined : (status as ListingStatus)
  const { data, isLoading } = trpc.listing.myListings.useQuery({ status: statusFilter, limit: 50 })

  const invalidate = () => {
    utils.listing.myListings.invalidate()
    utils.listing.myListingCount.invalidate()
  }
  const deactivate = trpc.listing.deactivate.useMutation({
    onSuccess: () => { toast.success('已下架'); invalidate() },
    onError: (err) => toast.error(err.message),
  })
  const reactivate = trpc.listing.reactivate.useMutation({
    onSuccess: () => { toast.success('已重新上架'); invalidate() },
    onError: (err) => toast.error(err.message),
  })
  const deleteListing = trpc.listing.delete.useMutation({
    onSuccess: () => { toast.success('已刪除'); invalidate() },
    onError: (err) => toast.error(err.message),
  })
  const publish = trpc.listing.publish.useMutation({
    onSuccess: () => { toast.success('已上架'); invalidate() },
    onError: (err) => toast.error(err.message),
  })

  const items = data?.items ?? []
  const isEmpty = !isLoading && items.length === 0

  return (
    <DashboardListShell
      title="代購管理"
      usageHint={`已使用 ${counts?.total ?? 0} / ${counts?.max ?? 25}`}
      newButton={{ href: '/dashboard/listings/new', label: '新增代購' }}
      tabs={[
        { value: 'all', label: '全部', count: counts?.total ?? 0 },
        { value: 'active', label: '上架中', count: counts?.active ?? 0 },
        { value: 'draft', label: '草稿', count: counts?.draft ?? 0 },
        { value: 'inactive', label: '已下架', count: counts?.inactive ?? 0 },
        { value: 'pending_approval', label: '待審核', count: counts?.pending_approval ?? 0 },
      ]}
      currentTab={status}
      onTabChange={setStatus}
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyState={{ icon: Package, title: '還沒有代購', description: '建立你的第一個代購商品吧!' }}
    >
      {/* Desktop: table */}
      <div className="hidden lg:block rounded-xl bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[72px]">圖片</TableHead>
              <TableHead>標題</TableHead>
              <TableHead>商品名稱</TableHead>
              <TableHead>售價</TableHead>
              <TableHead>截止日</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead className="w-[180px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((listing) => {
              const displayImages: DashboardThumbnailImage[] = (() => {
                const sorted = [...(listing.listing_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)
                if (sorted.length > 0) {
                  return sorted.map((img) => ({
                    url: img.thumbnail_url ?? img.url,
                    alt: listing.product?.name ?? '商品圖片',
                  }))
                }
                const catalogUrl = listing.product?.catalog_image?.thumbnail_url ?? listing.product?.catalog_image?.url
                return catalogUrl ? [{ url: catalogUrl, alt: listing.product?.name ?? '商品圖片' }] : []
              })()

              return (
                <TableRow
                  key={listing.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/dashboard/listings/${listing.id}/edit`)}
                >
                  <TableCell>
                    <DashboardThumbnailCell
                      images={displayImages}
                      title={listing.product?.name ?? '商品'}
                      fallbackIcon={Package}
                    />
                  </TableCell>
                  <TableCell className="max-w-[28ch] truncate font-medium">
                    {listing.title || <span className="font-normal text-muted-foreground">--</span>}
                  </TableCell>
                  <TableCell className="max-w-[24ch] truncate">
                    {listing.product?.name ? (
                      <Link
                        href={`/products/${listing.product_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {listing.product.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold whitespace-nowrap">
                    {formatPrice(listing.price, listing.is_price_on_request)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {listing.expires_at ? formatDate(listing.expires_at) : <span className="text-muted-foreground">--</span>}
                  </TableCell>
                  <TableCell>
                    <DashboardStatusDot
                      label={statusLabels[listing.status] ?? listing.status}
                      dotClassName={statusDotColors[listing.status]}
                    />
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <ListingActions
                      listing={listing}
                      onPublish={() => publish.mutate({ id: listing.id })}
                      onDeactivate={() => deactivate.mutate({ id: listing.id })}
                      onReactivate={() => reactivate.mutate({ id: listing.id })}
                      onDelete={() => deleteListing.mutate({ id: listing.id })}
                      pending={publish.isPending || deactivate.isPending || reactivate.isPending || deleteListing.isPending}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: card list */}
      <div className="lg:hidden space-y-3">
        {items.map((listing) => {
          const displayImages: DashboardThumbnailImage[] = (() => {
            const sorted = [...(listing.listing_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)
            if (sorted.length > 0) {
              return sorted.map((img) => ({
                url: img.thumbnail_url ?? img.url,
                alt: listing.product?.name ?? '商品圖片',
              }))
            }
            const catalogUrl = listing.product?.catalog_image?.thumbnail_url ?? listing.product?.catalog_image?.url
            return catalogUrl ? [{ url: catalogUrl, alt: listing.product?.name ?? '商品圖片' }] : []
          })()

          return (
            <div
              key={listing.id}
              className="rounded-xl bg-white p-3 shadow-sm cursor-pointer"
              onClick={() => router.push(`/dashboard/listings/${listing.id}/edit`)}
            >
              <div className="flex items-start gap-3 pb-3 border-b border-muted">
                <DashboardThumbnailCell
                  images={displayImages}
                  title={listing.product?.name ?? '商品'}
                  fallbackIcon={Package}
                  size={40}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="truncate font-semibold">{listing.title || '--'}</h3>
                  <DashboardStatusDot
                    label={statusLabels[listing.status] ?? listing.status}
                    dotClassName={statusDotColors[listing.status]}
                  />
                </div>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 py-3 text-sm">
                <span className="text-xs text-muted-foreground">商品名稱</span>
                <span className="truncate text-right">
                  {listing.product?.name ? (
                    <Link
                      href={`/products/${listing.product_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:underline"
                    >
                      {listing.product.name}
                    </Link>
                  ) : '--'}
                </span>
                <span className="text-xs text-muted-foreground">售價</span>
                <span className="text-right font-semibold">{formatPrice(listing.price, listing.is_price_on_request)}</span>
                <span className="text-xs text-muted-foreground">截止日</span>
                <span className="text-right">{listing.expires_at ? formatDate(listing.expires_at) : '--'}</span>
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                <ListingActions
                  listing={listing}
                  onPublish={() => publish.mutate({ id: listing.id })}
                  onDeactivate={() => deactivate.mutate({ id: listing.id })}
                  onReactivate={() => reactivate.mutate({ id: listing.id })}
                  onDelete={() => deleteListing.mutate({ id: listing.id })}
                  pending={publish.isPending || deactivate.isPending || reactivate.isPending || deleteListing.isPending}
                />
              </div>
            </div>
          )
        })}
      </div>
    </DashboardListShell>
  )
}

type ListingActionsProps = {
  listing: { id: string; status: string }
  onPublish: () => void
  onDeactivate: () => void
  onReactivate: () => void
  onDelete: () => void
  pending: boolean
}

function ListingActions({ listing, onPublish, onDeactivate, onReactivate, onDelete, pending }: ListingActionsProps) {
  return (
    <div className="inline-flex flex-wrap gap-2 justify-end">
      <Button size="sm" variant="outline" render={<Link href={`/dashboard/listings/${listing.id}/edit`} />}>編輯</Button>
      {listing.status === 'draft' && (
        <>
          <Button size="sm" onClick={onPublish} disabled={pending}>上架</Button>
          <Button size="sm" variant="destructive" onClick={onDelete} disabled={pending}>刪除</Button>
        </>
      )}
      {listing.status === 'active' && (
        <Button size="sm" variant="destructive" onClick={onDeactivate} disabled={pending}>下架</Button>
      )}
      {listing.status === 'inactive' && (
        <>
          <Button size="sm" onClick={onReactivate} disabled={pending}>重新上架</Button>
          <Button size="sm" variant="destructive" onClick={onDelete} disabled={pending}>刪除</Button>
        </>
      )}
      {listing.status === 'pending_approval' && (
        <Badge variant="outline" className="h-8 px-3">等待審核結果</Badge>
      )}
    </div>
  )
}
```

注意:
- 移除舊的 `ListingThumbnail`、`formatSpecSummary`、`listingGridClass`、`rowStyles`(已不需要)
- `ListingActions` sub-component 避免桌機/手機重複寫 buttons
- 編輯按鈕用 `Link` 不會觸發 row click(`stopPropagation` 在 `<td>` 上)
- 編輯按鈕 `Link` 跟 row click 都導去同一個 URL,點 row 跟點編輯按鈕效果一致(但編輯按鈕視覺上仍提示可操作)
- 桌機跟手機共用 `displayImages` 計算邏輯 — 若覺得重複可後續抽 hook,目前先 inline

- [ ] **Step 2: lint 過**

Run: `npm run lint`
Expected: 無錯誤

- [ ] **Step 3: TypeScript / build 過**

Run: `npm run build`
Expected: 成功編譯

如果 build 失敗,優先檢查:
- `listing.listing_images` 是否有 `sort_order`、`thumbnail_url` 欄位(從 router types 推斷)
- `listing.product?.catalog_image` 是否存在
- `listing.product?.name`、`listing.product_id`、`listing.is_price_on_request` 是否存在

若 type 不符,**不要 cast 成 `any`**;打開 `lib/trpc/routers/listing.ts`(或對應 router 檔)查實際回傳 type 後調整。

- [ ] **Step 4: 手動驗證 — 桌機**

啟 dev server:`npm run dev`
打開 `http://localhost:3000/dashboard/listings`(需登入賣家帳號)
驗證:
- [ ] 表格 header 7 欄正確顯示
- [ ] 每個 tab (全部/上架中/草稿/已下架/待審核) 點下去資料切換
- [ ] hover row 變色
- [ ] 點 row 進 `/dashboard/listings/[id]/edit`
- [ ] 點縮圖開 lightbox(不會觸發 row click)
- [ ] 點商品名連結進商品頁(不會觸發 row click)
- [ ] 點操作按鈕(編輯/上架/下架/刪除/重新上架)正常運作且不觸發 row click
- [ ] 各狀態(draft / active / inactive / pending_approval)按鈕組合正確

- [ ] **Step 5: 手動驗證 — 手機**

在 dev tools 切到手機尺寸 (e.g. iPhone 12, 390x844),或縮小視窗 < 1024px。
驗證:
- [ ] 表格隱藏,改顯示卡片清單
- [ ] 每張卡顯示 thumbnail + 標題 + 狀態 + 商品名 + 售價 + 截止日 + 操作
- [ ] 點卡片進編輯頁
- [ ] 點 thumbnail / 商品名連結 / 操作按鈕不觸發卡片 click

- [ ] **Step 6: 既有 Playwright 測試還能過**

Run: `npx playwright test tests/seller.spec.ts -g "Listing"`
(需先設 `E2E_SELLER_EMAIL` 等 env;若無法跑可略過,在 review 時手動補)
Expected: 全部 pass

- [ ] **Step 7: Checkpoint — 請使用者 review**

請使用者在桌機跟手機都看一次完整頁面後,確認下一步。

---

## Task 6: Refactor `app/(seller)/dashboard/connections/page.tsx`

跟 Task 5 完全平行,只是欄位跟 mutations 不同。

**Files:**
- Modify: `app/(seller)/dashboard/connections/page.tsx`(整個 component 重寫)

- [ ] **Step 1: 整頁改寫**

```tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DashboardListShell } from '@/components/dashboard/list-shell'
import { DashboardStatusDot } from '@/components/dashboard/status-dot'
import { DashboardThumbnailCell, type DashboardThumbnailImage } from '@/components/dashboard/thumbnail-cell'
import { trpc } from '@/lib/trpc/client'
import { formatDate } from '@/lib/utils/format'
import { toast } from 'sonner'

const statusLabels: Record<string, string> = {
  active: '進行中',
  ended: '已結束',
  pending_approval: '待審核',
}

const statusDotColors: Record<string, string> = {
  active: 'bg-green-500',
  ended: 'bg-gray-400',
  pending_approval: 'bg-red-500',
}

export default function SellerConnectionsPage() {
  const router = useRouter()
  const [status, setStatus] = useState<string>('all')
  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.connection.myConnections.useQuery({})

  const counts = {
    total: data?.length ?? 0,
    active: data?.filter((c) => c.status === 'active').length ?? 0,
    ended: data?.filter((c) => c.status === 'ended').length ?? 0,
    pending_approval: data?.filter((c) => c.status === 'pending_approval').length ?? 0,
  }

  const filtered = status === 'all' ? data ?? [] : (data ?? []).filter((c) => c.status === status)

  const invalidate = () => utils.connection.invalidate()
  const endConnection = trpc.connection.end.useMutation({
    onSuccess: () => { toast.success('已結束連線'); invalidate() },
    onError: (err) => toast.error(err.message),
  })
  const reactivate = trpc.connection.reactivate.useMutation({
    onSuccess: () => { toast.success('已更新連線狀態'); invalidate() },
    onError: (err) => toast.error(err.message),
  })
  const deleteConnection = trpc.connection.delete.useMutation({
    onSuccess: () => { toast.success('已刪除連線'); invalidate() },
    onError: (err) => toast.error(err.message),
  })

  const isEmpty = !isLoading && filtered.length === 0

  return (
    <DashboardListShell
      title="連線管理"
      usageHint={`已使用 ${counts.total} / 5`}
      newButton={{ href: '/dashboard/connections/new', label: '新增連線' }}
      tabs={[
        { value: 'all', label: '全部', count: counts.total },
        { value: 'active', label: '進行中', count: counts.active },
        { value: 'ended', label: '已結束', count: counts.ended },
        { value: 'pending_approval', label: '待審核', count: counts.pending_approval },
      ]}
      currentTab={status}
      onTabChange={setStatus}
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyState={{ icon: Globe, title: '還沒有連線公告', description: '新增連線公告讓買家知道你的代購行程!' }}
    >
      {/* Desktop: table */}
      <div className="hidden lg:block rounded-xl bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[72px]">圖片</TableHead>
              <TableHead>標題</TableHead>
              <TableHead>國家</TableHead>
              <TableHead>連線日期</TableHead>
              <TableHead>預計出貨</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead className="w-[200px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((conn) => {
              const sorted = [...(conn.connection_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)
              const displayImages: DashboardThumbnailImage[] = sorted.map((img) => ({
                url: img.thumbnail_url ?? img.url,
                alt: conn.title ?? '連線圖片',
              }))

              return (
                <TableRow
                  key={conn.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/dashboard/connections/${conn.id}/edit`)}
                >
                  <TableCell>
                    <DashboardThumbnailCell
                      images={displayImages}
                      title={conn.title ?? '連線'}
                      fallbackIcon={Globe}
                    />
                  </TableCell>
                  <TableCell className="max-w-[28ch] truncate font-medium">
                    {conn.title || <span className="font-normal text-muted-foreground">--</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{conn.region?.name ?? '--'}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(conn.start_date)} ~ {formatDate(conn.end_date)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {conn.shipping_date ? formatDate(conn.shipping_date) : <span className="text-muted-foreground">--</span>}
                  </TableCell>
                  <TableCell>
                    <div className="inline-flex items-center gap-2">
                      <DashboardStatusDot
                        label={statusLabels[conn.status] ?? conn.status}
                        dotClassName={statusDotColors[conn.status]}
                      />
                      {conn.can_wish && (
                        <span className="inline-flex items-center gap-1 text-xs text-purple-700">
                          <Sparkles className="h-3 w-3" />可許願
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <ConnectionActions
                      connection={conn}
                      onEnd={() => endConnection.mutate({ id: conn.id })}
                      onReactivate={() => reactivate.mutate({ id: conn.id })}
                      onDelete={() => deleteConnection.mutate({ id: conn.id })}
                      pending={endConnection.isPending || reactivate.isPending || deleteConnection.isPending}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: card list */}
      <div className="lg:hidden space-y-3">
        {filtered.map((conn) => {
          const sorted = [...(conn.connection_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)
          const displayImages: DashboardThumbnailImage[] = sorted.map((img) => ({
            url: img.thumbnail_url ?? img.url,
            alt: conn.title ?? '連線圖片',
          }))

          return (
            <div
              key={conn.id}
              className="rounded-xl bg-white p-3 shadow-sm cursor-pointer"
              onClick={() => router.push(`/dashboard/connections/${conn.id}/edit`)}
            >
              <div className="flex items-start gap-3 pb-3 border-b border-muted">
                <DashboardThumbnailCell
                  images={displayImages}
                  title={conn.title ?? '連線'}
                  fallbackIcon={Globe}
                  size={40}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="truncate font-semibold">{conn.title || '--'}</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DashboardStatusDot
                      label={statusLabels[conn.status] ?? conn.status}
                      dotClassName={statusDotColors[conn.status]}
                    />
                    {conn.can_wish && (
                      <span className="inline-flex items-center gap-1 text-xs text-purple-700">
                        <Sparkles className="h-3 w-3" />可許願
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 py-3 text-sm">
                <span className="text-xs text-muted-foreground">國家</span>
                <span className="text-right truncate">{conn.region?.name ?? '--'}</span>
                <span className="text-xs text-muted-foreground">連線日期</span>
                <span className="text-right">{formatDate(conn.start_date)} ~ {formatDate(conn.end_date)}</span>
                <span className="text-xs text-muted-foreground">預計出貨</span>
                <span className="text-right">{conn.shipping_date ? formatDate(conn.shipping_date) : '--'}</span>
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                <ConnectionActions
                  connection={conn}
                  onEnd={() => endConnection.mutate({ id: conn.id })}
                  onReactivate={() => reactivate.mutate({ id: conn.id })}
                  onDelete={() => deleteConnection.mutate({ id: conn.id })}
                  pending={endConnection.isPending || reactivate.isPending || deleteConnection.isPending}
                />
              </div>
            </div>
          )
        })}
      </div>
    </DashboardListShell>
  )
}

type ConnectionActionsProps = {
  connection: { id: string; status: string }
  onEnd: () => void
  onReactivate: () => void
  onDelete: () => void
  pending: boolean
}

function ConnectionActions({ connection, onEnd, onReactivate, onDelete, pending }: ConnectionActionsProps) {
  return (
    <div className="inline-flex flex-wrap gap-2 justify-end">
      <Button size="sm" variant="outline" render={<Link href={`/dashboard/connections/${connection.id}/edit`} />}>編輯</Button>
      {connection.status === 'active' && (
        <Button size="sm" variant="destructive" onClick={onEnd} disabled={pending}>結束</Button>
      )}
      {connection.status === 'ended' && (
        <>
          <Button size="sm" onClick={onReactivate} disabled={pending}>重新上架</Button>
          <Button size="sm" variant="destructive" onClick={onDelete} disabled={pending}>刪除</Button>
        </>
      )}
      {connection.status === 'pending_approval' && (
        <Badge variant="outline" className="h-8 px-3">等待審核結果</Badge>
      )}
    </div>
  )
}
```

注意:
- 移除舊的 `ConnectionThumbnail`、`connectionGridClass`、`rowStyles`、`SafeExternalLink` import(本頁已不需要 post_link 顯示)
- 移除 `SellerConnection` type annotation 的 `as any` cast — 改用 `conn.can_wish`(若 router type 沒有,需在 router output 加上;此情況下保留 `(conn as any).can_wish` 作為暫時 workaround 並在備註中標記)

**若 `can_wish` 不在 type 上:**

如果 build 報 `Property 'can_wish' does not exist`,有兩個選擇:
- (A) 在 router output 把 `can_wish` 補上(查 `lib/trpc/routers/connection.ts` 的 `myConnections` procedure,看 select 是否漏選)
- (B) 暫時用 `(conn as { can_wish?: boolean }).can_wish` 而非 `any` cast — 範圍更小、安全。建議先 (B) 不阻塞 refactor,完成後另起 issue 處理 (A)。

- [ ] **Step 2: lint 過**

Run: `npm run lint`
Expected: 無錯誤

- [ ] **Step 3: TypeScript / build 過**

Run: `npm run build`
Expected: 成功編譯

- [ ] **Step 4: 手動驗證 — 桌機**

`http://localhost:3000/dashboard/connections`
驗證:
- [ ] 表格 7 欄正確
- [ ] tabs (全部/進行中/已結束/待審核) 切換
- [ ] 點 row 進編輯
- [ ] 點縮圖開 lightbox 不觸發 row click
- [ ] 點按鈕(結束/重新上架/刪除)不觸發 row click
- [ ] `can_wish` flag 為 true 的連線會多顯示「可許願」標記

- [ ] **Step 5: 手動驗證 — 手機**

縮小視窗 < 1024px。
驗證卡片版顯示與互動同 Task 5。

- [ ] **Step 6: 既有 Playwright 測試還能過**

Run: `npx playwright test tests/seller.spec.ts -g "Connection"`
Expected: pass

- [ ] **Step 7: Checkpoint — 請使用者 review**

兩頁都完成後,請使用者最後一次完整確認桌機 + 手機的視覺與互動。

---

## Self-Review

**Spec coverage:**
- 代購管理 7 欄(圖/標題/商品名/售價/截止日/狀態/操作) → Task 5 ✓
- 連線管理 7 欄(圖/標題/國家/連線日期/預計出貨/狀態/操作)→ Task 6 ✓
- Soft 視覺風格 → Task 1 (Table primitive 樣式) ✓
- Row click 進編輯 → Task 5 / Task 6 ✓
- stopPropagation on 按鈕/縮圖/商品名連結 → Task 5 / Task 6 ✓
- Lightbox 保留 → Task 3 (DashboardThumbnailCell) ✓
- 狀態圓點 + 文字 → Task 2 (DashboardStatusDot) ✓
- 手機 fallback 卡片 → Task 5 / Task 6 ✓
- 共用元件 `DashboardListShell` / `DashboardStatusDot` / `DashboardThumbnailCell` → Tasks 2-4 ✓
- shadcn `<Table>` 新增 → Task 1 ✓
- 移除舊 `rowStyles` / grid class → Task 5 / Task 6 ✓
- 清理 `(conn as any).can_wish` → Task 6 (備註處理) ✓

**Placeholder scan:** 無 TBD / TODO。所有 code 步驟都有完整 code。

**Type 一致性:** `DashboardStatusDot` 在 Task 2 定義為 `{ label, dotClassName }`,Task 5/6 呼叫一致;`DashboardThumbnailCell` 在 Task 3 定義為 `{ images, title, fallbackIcon, size?, className? }`,Task 5/6 呼叫一致(其中 mobile 傳 `size={40}`,desktop 用 default 48);`DashboardListShell` 在 Task 4 定義所有 props,Task 5/6 呼叫一致。
