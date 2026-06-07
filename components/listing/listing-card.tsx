import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { formatPrice, formatShippingDate } from '@/lib/utils/format'

interface ListingCardProps {
  listing: {
    id: string
    title?: string | null
    price: number | null
    is_price_on_request: boolean
    shipping_date: string | null
    status: string
    product?: { id: string; name: string; brand?: string | { name: string } | null; model_number?: string | null } | null
    seller?: { id: string; name: string } | null
    listing_images?: { url: string; thumbnail_url?: string | null; sort_order: number }[]
  }
  showStatus?: boolean
  showBrand?: boolean
  showShippingDate?: boolean
  tallImage?: boolean
}

export function ListingCard({ listing, showStatus = false, showBrand = true, showShippingDate = true, tallImage = false }: ListingCardProps) {
  const firstImage = listing.listing_images?.sort((a, b) => a.sort_order - b.sort_order)[0]
  const imageUrl = firstImage?.thumbnail_url ?? firstImage?.url ?? null
  const brandLabel = typeof listing.product?.brand === 'string' ? listing.product.brand : listing.product?.brand?.name ?? null

  const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: '草稿', variant: 'secondary' },
    active: { label: '上架中', variant: 'default' },
    inactive: { label: '已下架', variant: 'destructive' },
    pending_approval: { label: '審核中', variant: 'outline' },
  }

  return (
    <Link href={`/listings/${listing.id}`}>
      <div className="group overflow-hidden rounded-none bg-white md:rounded-2xl md:shadow-md md:transition-shadow md:hover:shadow-lg">
        <div className={`relative overflow-hidden bg-white ${tallImage ? 'aspect-square md:h-[180px] md:aspect-auto' : 'aspect-square md:aspect-video'}`}>
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={listing.product?.name ?? ''}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              暫無圖片
            </div>
          )}
        </div>
        <div className="space-y-0.5 px-1.5 pb-1.5 pt-1 md:space-y-2 md:px-3 md:pb-3 md:pt-2">
          {listing.product && (
            <div className="grid gap-0.5">
              {showBrand && brandLabel && (
                <p className="truncate text-[11px] font-medium leading-none text-muted-foreground">{brandLabel}</p>
              )}
              <h3 className="line-clamp-2 min-h-[2lh] text-[10px] leading-tight md:text-base md:font-bold md:leading-snug md:min-h-0">
                {listing.title || listing.product.name}
              </h3>
              {listing.title && listing.product.name && (
                <p className="line-clamp-1 text-[12.5px] font-medium leading-normal text-muted-foreground">{listing.product.name}</p>
              )}
            </div>
          )}
          {listing.seller && (
            <p className="text-xs text-muted-foreground">{listing.seller.name}</p>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-bold md:text-sm md:font-semibold" style={{ color: 'var(--brand-700)' }}>
              {formatPrice(listing.price, listing.is_price_on_request)}
            </span>
            {showShippingDate && (
              <Badge variant="outline" className="text-[11px]">
                {formatShippingDate(listing.shipping_date)}
              </Badge>
            )}
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
