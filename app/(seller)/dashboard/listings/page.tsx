'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Package } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { ProductCard } from '@/components/product/product-card'
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
        <TabsList>
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
          {data.items.map((listing) => (
            <div key={listing.id} className={`rounded-2xl border bg-white p-4 ${listing.status === 'inactive' ? 'opacity-80' : ''}`}>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,260px)_1fr]">
                <ProductCard
                  product={{
                    id: listing.product?.id ?? listing.id,
                    name: listing.product?.name ?? '未知商品',
                    brand: listing.product?.brand ?? null,
                    model_number: listing.product?.model_number ?? null,
                    catalog_image: listing.product?.catalog_image ?? null,
                    product_images: listing.product?.product_images ?? [],
                  }}
                  linkToProduct={false}
                />

                <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className={statusColors[listing.status]}>{statusLabels[listing.status]}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatPrice(listing.price, listing.is_price_on_request)} · 建立於 {formatDate(listing.created_at)}
                      </span>
                    </div>
                    {listing.status === 'pending_approval' && (
                      <Badge variant="outline" className="w-fit">審核中</Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" render={<Link href={`/dashboard/listings/${listing.id}/edit`} />}>編輯</Button>
                    {listing.status === 'draft' && (
                      <>
                        <Button size="sm" onClick={() => publish.mutate({ id: listing.id })} disabled={publish.isPending}>上架</Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteListing.mutate({ id: listing.id })} disabled={deleteListing.isPending}>刪除</Button>
                      </>
                    )}
                    {listing.status === 'active' && (
                      <Button size="sm" variant="destructive" onClick={() => deactivate.mutate({ id: listing.id })} disabled={deactivate.isPending}>下架</Button>
                    )}
                    {listing.status === 'inactive' && (
                      <Button size="sm" onClick={() => reactivate.mutate({ id: listing.id })} disabled={reactivate.isPending}>重新上架</Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Package} title="還沒有代購" description="建立你的第一個代購商品吧！" />
      )}
    </div>
  )
}
