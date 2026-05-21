'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DashboardListShell } from '@/components/dashboard/list-shell'
import { DashboardStatusDot } from '@/components/dashboard/status-dot'
import { DashboardThumbnailCell, type DashboardThumbnailImage } from '@/components/dashboard/thumbnail-cell'
import { trpc } from '@/lib/trpc/client'
import { formatPrice, formatDate } from '@/lib/utils/format'
import { toast } from 'sonner'

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

type ListingItem = {
  id: string
  title: string | null
  product_id: string
  product?: {
    name?: string | null
    catalog_image?: { url?: string | null; thumbnail_url?: string | null } | null
  } | null
  listing_images?: Array<{ url: string; thumbnail_url?: string | null; sort_order: number }> | null
  status: string
  price: number | null
  is_price_on_request: boolean
  expires_at: string | null
}

function buildDisplayImages(listing: ListingItem): DashboardThumbnailImage[] {
  const sorted = [...(listing.listing_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  if (sorted.length > 0) {
    return sorted.map((img) => ({
      url: img.thumbnail_url ?? img.url,
      alt: listing.product?.name ?? '商品圖片',
    }))
  }
  const catalogUrl = listing.product?.catalog_image?.thumbnail_url ?? listing.product?.catalog_image?.url
  return catalogUrl ? [{ url: catalogUrl, alt: listing.product?.name ?? '商品圖片' }] : []
}

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

  const items = (data?.items ?? []) as ListingItem[]
  const isEmpty = !isLoading && items.length === 0
  const actionPending =
    publish.isPending || deactivate.isPending || reactivate.isPending || deleteListing.isPending

  const actionHandlers = (id: string) => ({
    onPublish: () => publish.mutate({ id }),
    onDeactivate: () => deactivate.mutate({ id }),
    onReactivate: () => reactivate.mutate({ id }),
    onDelete: () => deleteListing.mutate({ id }),
  })

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
      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[96px]">圖片</TableHead>
              <TableHead>標題</TableHead>
              <TableHead>商品名稱</TableHead>
              <TableHead>售價</TableHead>
              <TableHead>截止日</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead className="w-[200px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((listing) => {
              const displayImages = buildDisplayImages(listing)
              const handlers = actionHandlers(listing.id)
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
                  <TableCell className="whitespace-nowrap font-semibold">
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
                      listingId={listing.id}
                      listingStatus={listing.status}
                      pending={actionPending}
                      {...handlers}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="lg:hidden space-y-3">
        {items.map((listing) => {
          const displayImages = buildDisplayImages(listing)
          const handlers = actionHandlers(listing.id)
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
                  size={56}
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
                  listingId={listing.id}
                  listingStatus={listing.status}
                  pending={actionPending}
                  {...handlers}
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
  listingId: string
  listingStatus: string
  pending: boolean
  onPublish: () => void
  onDeactivate: () => void
  onReactivate: () => void
  onDelete: () => void
}

function ListingActions({
  listingId,
  listingStatus,
  pending,
  onPublish,
  onDeactivate,
  onReactivate,
  onDelete,
}: ListingActionsProps) {
  return (
    <div className="inline-flex flex-wrap gap-2 justify-end">
      <Button size="sm" variant="outline" render={<Link href={`/dashboard/listings/${listingId}/edit`} />}>編輯</Button>
      {listingStatus === 'draft' && (
        <>
          <Button size="sm" onClick={onPublish} disabled={pending}>上架</Button>
          <Button size="sm" variant="destructive" onClick={onDelete} disabled={pending}>刪除</Button>
        </>
      )}
      {listingStatus === 'active' && (
        <Button size="sm" variant="destructive" onClick={onDeactivate} disabled={pending}>下架</Button>
      )}
      {listingStatus === 'inactive' && (
        <>
          <Button size="sm" onClick={onReactivate} disabled={pending}>重新上架</Button>
          <Button size="sm" variant="destructive" onClick={onDelete} disabled={pending}>刪除</Button>
        </>
      )}
      {listingStatus === 'pending_approval' && (
        <Badge variant="outline" className="h-8 px-3">等待審核結果</Badge>
      )}
    </div>
  )
}
