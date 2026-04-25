import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { formatPrice, formatShippingDays } from '@/lib/utils/format'

interface ListingCardProps {
  listing: {
    id: string
    price: number | null
    is_price_on_request: boolean
    shipping_days: number
    status: string
    product?: { id: string; name: string; brand?: string | { name: string } | null; model_number?: string | null } | null
    seller?: { id: string; name: string } | null
    listing_images?: { url: string; sort_order: number }[]
  }
  showStatus?: boolean
}

export function ListingCard({ listing, showStatus = false }: ListingCardProps) {
  const firstImage = listing.listing_images?.sort((a, b) => a.sort_order - b.sort_order)[0]
  const brandLabel = typeof listing.product?.brand === 'string' ? listing.product.brand : listing.product?.brand?.name ?? null

  const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: '草稿', variant: 'secondary' },
    active: { label: '上架中', variant: 'default' },
    inactive: { label: '已下架', variant: 'destructive' },
    pending_approval: { label: '審核中', variant: 'outline' },
  }

  return (
    <Link href={`/listings/${listing.id}`}>
      <div className="group overflow-hidden rounded-2xl bg-white shadow-md transition-shadow hover:shadow-lg">
        <div className="relative aspect-video overflow-hidden bg-white">
          {firstImage ? (
            <Image
              src={firstImage.url}
              alt={listing.product?.name ?? ''}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform group-hover:scale-105"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              暫無圖片
            </div>
          )}
        </div>
        <div className="space-y-2 px-3 pb-3 pt-2">
          {listing.product && (
            <div className="grid min-h-[3rem] gap-1">
              <div className="h-3.5 overflow-hidden">
                {brandLabel ? (
                  <p className="truncate text-[11px] font-medium leading-none text-muted-foreground">{brandLabel}</p>
                ) : (
                  <span aria-hidden="true" className="block h-3.5" />
                )}
              </div>
              <div className="h-[1.15rem] overflow-hidden">
                <h3 className="line-clamp-1 text-sm font-semibold leading-tight">{listing.product.name}</h3>
              </div>
              <div className="h-3.5 overflow-hidden">
                {listing.product.model_number ? (
                  <p className="truncate text-[11px] leading-none text-muted-foreground">{listing.product.model_number}</p>
                ) : (
                  <span aria-hidden="true" className="block h-3.5" />
                )}
              </div>
            </div>
          )}
          {listing.seller && (
            <p className="text-xs text-muted-foreground">{listing.seller.name}</p>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="text-sm font-semibold text-primary">
              {formatPrice(listing.price, listing.is_price_on_request)}
            </span>
            <Badge variant="outline" className="text-[11px]">
              {formatShippingDays(listing.shipping_days)}
            </Badge>
          </div>
          {showStatus && (
            <Badge variant={statusLabels[listing.status]?.variant ?? 'secondary'} className="text-[11px]">
              {statusLabels[listing.status]?.label ?? listing.status}
            </Badge>
          )}
        </div>
      </div>
    </Link>
  )
}
