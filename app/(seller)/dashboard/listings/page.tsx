'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Package, ExternalLink, MoreHorizontal, MoreVertical } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DashboardListShell } from '@/components/dashboard/list-shell'
import { DashboardStatusDot } from '@/components/dashboard/status-dot'
import { DashboardThumbnailCell, type DashboardThumbnailImage } from '@/components/dashboard/thumbnail-cell'
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
    id?: string
    name?: string | null
    is_removed?: boolean
    catalog_image?: { url?: string | null; thumbnail_url?: string | null } | null
  } | null
  listing_images?: Array<{ url: string; thumbnail_url?: string | null; sort_order: number }> | null
  status: string
  price: number | null
  is_price_on_request: boolean
  expires_at: string | null
  post_url?: string | null
  inactive_reason?: string | null
  admin_note?: string | null
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
    publish.isPending || deactivate.isPending || deleteListing.isPending

  const actionHandlers = (id: string) => ({
    onPublish: () => publish.mutate({ id }),
    onDeactivate: () => deactivate.mutate({ id }),
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
              <TableHead className="w-[120px] text-center">貼文/頁面</TableHead>
              <TableHead className="w-[120px] text-left">操作</TableHead>
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
                  <TableCell className="max-w-[28ch] font-medium">
                    <span className="line-clamp-2">
                      {listing.title || <span className="font-normal text-muted-foreground">--</span>}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[24ch] truncate">
                    {listing.product?.is_removed === true ? (
                      <span className="text-destructive font-medium">此商品已被移除</span>
                    ) : listing.product?.name ? (
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
                      warning={listing.inactive_reason === 'admin' ? (listing.admin_note || '此代購已被管理員下架') : null}
                    />
                  </TableCell>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    {listing.post_url ? (
                      <SafeExternalLink
                        href={listing.post_url}
                        variant="outline"
                        size="sm"
                        aria-label="前往貼文或群組"
                        title="前往貼文／群組"
                      >
                        連結
                        <ExternalLink className="h-3.5 w-3.5" />
                      </SafeExternalLink>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-left" onClick={(e) => e.stopPropagation()}>
                    <ListingActions
                      listingId={listing.id}
                      listingStatus={listing.status}
                      productRemoved={listing.product?.is_removed === true}
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

      <div className="lg:hidden space-y-1.5">
        {items.map((listing) => {
          const displayImages = buildDisplayImages(listing)
          const handlers = actionHandlers(listing.id)
          return (
            <div
              key={listing.id}
              className="flex items-center gap-2.5 rounded-lg border border-border-soft bg-white p-2.5 cursor-pointer"
              onClick={() => router.push(`/dashboard/listings/${listing.id}/edit`)}
            >
              <DashboardThumbnailCell
                images={displayImages}
                title={listing.product?.name ?? '商品'}
                fallbackIcon={Package}
                size={48}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium truncate leading-tight">{listing.title || listing.product?.name || '--'}</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5 leading-tight">
                  {listing.product?.name ?? ''}
                  {listing.price != null ? ` · ${formatPrice(listing.price, listing.is_price_on_request)}` : listing.is_price_on_request ? ' · 私訊報價' : ''}
                </p>
                <div className="mt-0.5">
                  <DashboardStatusDot
                    label={statusLabels[listing.status] ?? listing.status}
                    dotClassName={statusDotColors[listing.status]}
                    warning={listing.inactive_reason === 'admin' ? (listing.admin_note || '此代購已被管理員下架') : null}
                  />
                </div>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <ListingActions
                  listingId={listing.id}
                  listingStatus={listing.status}
                  productRemoved={listing.product?.is_removed === true}
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
  productRemoved: boolean
  pending: boolean
  onPublish: () => void
  onDeactivate: () => void
  onDelete: () => void
}

function ListingActions({
  listingId,
  listingStatus,
  productRemoved,
  pending,
  onPublish,
  onDeactivate,
  onDelete,
}: ListingActionsProps) {
  return (
    <div className="inline-flex items-center justify-start gap-2 max-md:gap-1">
      <Button size="xs" variant="outline" render={<Link href={`/dashboard/listings/${listingId}/edit`} />}>編輯</Button>
      {listingStatus === 'pending_approval' ? (
        <span aria-hidden className={buttonVariants({ variant: 'ghost', size: 'icon-xs', className: 'invisible md:hidden' })} />
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            nativeButton={false}
            disabled={pending}
            aria-label="更多操作"
            render={
              <span className={buttonVariants({ variant: 'ghost', size: 'icon-xs' })}>
                <MoreHorizontal className="hidden h-4 w-4 md:block" />
                <MoreVertical className="h-3.5 w-3.5 md:hidden" />
              </span>
            }
          />
          <DropdownMenuContent align="end">
            {listingStatus === 'draft' && (
              <>
                <DropdownMenuItem onClick={onPublish}>上架</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={onDelete}>刪除</DropdownMenuItem>
              </>
            )}
            {listingStatus === 'active' && (
              <DropdownMenuItem variant="destructive" onClick={onDeactivate}>下架</DropdownMenuItem>
            )}
            {listingStatus === 'inactive' && (
              <DropdownMenuItem variant="destructive" onClick={onDelete}>刪除</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
