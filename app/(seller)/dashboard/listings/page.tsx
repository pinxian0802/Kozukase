'use client'

import Image from 'next/image'
import { useState } from 'react'
import Link from 'next/link'
import { Calendar, Clock3, ExternalLink, FileText, Images, Package, Plus, Tag } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { SafeExternalLink } from '@/components/shared/safe-external-link'
import { trpc } from '@/lib/trpc/client'
import { formatPrice, formatDate } from '@/lib/utils/format'
import { toast } from 'sonner'

const statusLabels: Record<string, string> = {
  draft: '草稿',
  active: '上架中',
  inactive: '已下架',
  pending_approval: '待審核',
}

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  pending_approval: 'bg-blue-100 text-blue-700',
}

const rowStyles: Record<string, string> = {
  draft: 'border-border bg-white',
  active: 'border-border bg-white',
  inactive: 'border-border bg-white',
  pending_approval: 'border-border bg-white',
}

const listingGridClass = 'grid gap-4 lg:grid-cols-[minmax(0,4.1fr)_minmax(152px,0.88fr)_minmax(132px,0.72fr)_minmax(132px,0.72fr)_minmax(132px,0.72fr)_minmax(124px,0.78fr)]'

type ListingSpec = {
  type: string
  is_all: boolean
  options: string[]
}

function formatSpecSummary(spec?: ListingSpec | null) {
  if (!spec) return '未設定'
  if (spec.is_all) return `${spec.type}：都有`

  const options = spec.options?.filter(Boolean) ?? []
  if (options.length === 0) return `${spec.type}：未設定`

  return `${spec.type}：${options.slice(0, 3).join(' / ')}`
}

export default function SellerListingsPage() {
  const [status, setStatus] = useState<string>('all')
  const utils = trpc.useUtils()
  const { data: counts } = trpc.listing.myListingCount.useQuery()

  const statusFilter = status === 'all'
    ? undefined
    : (status as 'draft' | 'active' | 'inactive' | 'pending_approval')
  const { data, isLoading } = trpc.listing.myListings.useQuery({ status: statusFilter, limit: 50 })

  const deactivate = trpc.listing.deactivate.useMutation({
    onSuccess: () => { toast.success('已下架'); utils.listing.myListings.invalidate(); utils.listing.myListingCount.invalidate() },
    onError: (err) => toast.error(err.message),
  })
  const reactivate = trpc.listing.reactivate.useMutation({
    onSuccess: () => { toast.success('已重新上架'); utils.listing.myListings.invalidate(); utils.listing.myListingCount.invalidate() },
    onError: (err) => toast.error(err.message),
  })
  const deleteListing = trpc.listing.delete.useMutation({
    onSuccess: () => { toast.success('已刪除'); utils.listing.myListings.invalidate(); utils.listing.myListingCount.invalidate() },
    onError: (err) => toast.error(err.message),
  })
  const publish = trpc.listing.publish.useMutation({
    onSuccess: () => { toast.success('已上架'); utils.listing.myListings.invalidate(); utils.listing.myListingCount.invalidate() },
    onError: (err) => toast.error(err.message),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">代購管理</h1>
          <p className="text-sm text-muted-foreground">已使用 {counts?.total ?? 0} / {counts?.max ?? 25}</p>
        </div>
        <Button render={<Link href="/dashboard/listings/new" />}><Plus className="mr-1 h-4 w-4" />新增代購</Button>
      </div>

      <Tabs value={status} onValueChange={setStatus}>
        <TabsList variant="line" className="flex-wrap w-full border-b border-border">
          <TabsTrigger value="all">全部 ({counts?.total ?? 0})</TabsTrigger>
          <TabsTrigger value="active">上架中 ({counts?.active ?? 0})</TabsTrigger>
          <TabsTrigger value="draft">草稿 ({counts?.draft ?? 0})</TabsTrigger>
          <TabsTrigger value="inactive">已下架 ({counts?.inactive ?? 0})</TabsTrigger>
          <TabsTrigger value="pending_approval">待審核 ({counts?.pending_approval ?? 0})</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      ) : data?.items && data.items.length > 0 ? (
        <div className="space-y-4">
          <div className={`hidden items-center gap-4 px-4 text-xs font-medium tracking-[0.18em] text-muted-foreground/80 lg:${listingGridClass}`}>
            <span className="justify-self-start">商品</span>
            <span className="justify-self-start">規格與備註</span>
            <span className="justify-self-start">到貨與時程</span>
            <span className="justify-self-center" aria-hidden="true" />
            <span className="justify-self-start pl-2">價格</span>
            <span className="w-24 justify-self-end text-center">操作</span>
          </div>

          {data.items.map((listing) => {
            const firstListingImage = [...(listing.listing_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]
            const imageUrl = firstListingImage?.thumbnail_url
              ?? firstListingImage?.url
              ?? listing.product?.catalog_image?.thumbnail_url
              ?? listing.product?.catalog_image?.url
              ?? null
            const brandLabel = typeof listing.product?.brand === 'string'
              ? listing.product.brand
              : listing.product?.brand?.name

            return (
            <div
              key={listing.id}
              className={`overflow-hidden rounded-[28px] border p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)] transition-colors ${rowStyles[listing.status] ?? 'border-border bg-white'} ${listing.status === 'inactive' ? 'opacity-85' : ''}`}
            >
              <div className={`${listingGridClass} lg:items-center`}>
                <div className="flex min-w-0 gap-4">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border bg-muted/40">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={listing.product?.name ?? '商品圖片'}
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground/50">
                        <Package className="h-7 w-7" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 space-y-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className={statusColors[listing.status]}>{statusLabels[listing.status]}</Badge>
                        {listing.status === 'pending_approval' && (
                          <Badge variant="outline">審核中</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">建立於 {formatDate(listing.created_at)}</span>
                      </div>
                      {brandLabel && (
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          {brandLabel}
                        </p>
                      )}
                      <h2 className="truncate text-lg font-semibold text-foreground">
                        {listing.product?.name ?? '未知商品'}
                      </h2>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        {listing.product?.model_number && <span>型號 {listing.product.model_number}</span>}
                        <span className="inline-flex items-center gap-1"><Images className="h-3.5 w-3.5" />{listing.listing_images?.length ?? 0} 張圖片</span>
                      </div>
                    </div>

                  </div>
                </div>

                <div className="space-y-3 rounded-2xl bg-background/70 p-3 lg:bg-transparent lg:p-0">
                  <div className="space-y-1">
                    <p className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground">
                      <Tag className="h-3.5 w-3.5" />規格摘要
                    </p>
                    <div className="space-y-1.5 text-sm text-foreground/85">
                      {(listing.specs ?? []).length > 0 ? (
                        (listing.specs ?? []).slice(0, 3).map((spec: ListingSpec, index: number) => (
                          <p key={`${listing.id}-spec-line-${index}`} className="truncate">{formatSpecSummary(spec)}</p>
                        ))
                      ) : (
                        <p className="text-muted-foreground">尚未設定規格</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />備註
                    </p>
                    <p className="line-clamp-2 text-sm text-foreground/80">
                      {listing.note ? listing.note : '未填寫備註'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl bg-background/70 p-3 lg:bg-transparent lg:p-0">
                  <div className="space-y-1">
                    <p className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />預計出貨
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {listing.shipping_date ? formatDate(listing.shipping_date) : '未設定'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />截止日期
                    </p>
                    <p className="text-sm text-foreground/80">
                      {listing.expires_at ? formatDate(listing.expires_at) : '未設定'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start lg:pt-1">
                  {listing.post_url ? (
                    <SafeExternalLink
                      href={listing.post_url}
                      size="sm"
                      variant="outline"
                      className="w-full justify-center"
                    >
                      查看貼文
                      <ExternalLink className="h-3.5 w-3.5" />
                    </SafeExternalLink>
                  ) : null}
                </div>

                <div className="space-y-2 lg:text-left lg:pl-2">
                  <p className="text-[11px] font-medium tracking-[0.2em] text-muted-foreground">售價</p>
                  <p className="text-2xl font-bold tracking-tight text-foreground">
                    {formatPrice(listing.price, listing.is_price_on_request)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {listing.is_price_on_request ? '由買家私訊詢價' : '含代購服務資訊'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end">
                  <Button size="sm" variant="outline" className="min-w-24" render={<Link href={`/dashboard/listings/${listing.id}/edit`} />}>編輯</Button>
                  {listing.status === 'draft' && (
                    <>
                      <Button size="sm" className="min-w-24" onClick={() => publish.mutate({ id: listing.id })} disabled={publish.isPending}>上架</Button>
                      <Button size="sm" variant="destructive" className="min-w-24" onClick={() => deleteListing.mutate({ id: listing.id })} disabled={deleteListing.isPending}>刪除</Button>
                    </>
                  )}
                  {listing.status === 'active' && (
                    <Button size="sm" variant="destructive" className="min-w-24" onClick={() => deactivate.mutate({ id: listing.id })} disabled={deactivate.isPending}>下架</Button>
                  )}
                  {listing.status === 'inactive' && (
                    <>
                      <Button size="sm" className="min-w-24" onClick={() => reactivate.mutate({ id: listing.id })} disabled={reactivate.isPending}>重新上架</Button>
                      <Button size="sm" variant="destructive" className="min-w-24" onClick={() => deleteListing.mutate({ id: listing.id })} disabled={deleteListing.isPending}>刪除</Button>
                    </>
                  )}
                  {listing.status === 'pending_approval' && (
                    <Badge variant="outline" className="h-8 px-3">等待審核結果</Badge>
                  )}
                </div>
              </div>
            </div>
            )
          })}
        </div>
      ) : (
        <EmptyState icon={Package} title="還沒有代購" description="建立你的第一個代購商品吧！" />
      )}
    </div>
  )
}
