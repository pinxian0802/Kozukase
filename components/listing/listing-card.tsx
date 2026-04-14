import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatPrice, formatShippingDays } from '@/lib/utils/format'

interface ListingCardProps {
  listing: {
    id: string
    price: number | null
    is_price_on_request: boolean
    shipping_days: number
    status: string
    product?: { id: string; name: string } | null
    seller?: { id: string; name: string } | null
    listing_images?: { url: string; sort_order: number }[]
  }
  showStatus?: boolean
}

export function ListingCard({ listing, showStatus = false }: ListingCardProps) {
  const firstImage = listing.listing_images?.sort((a, b) => a.sort_order - b.sort_order)[0]

  const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: '草稿', variant: 'secondary' },
    active: { label: '上架中', variant: 'default' },
    inactive: { label: '已下架', variant: 'destructive' },
    pending_approval: { label: '審核中', variant: 'outline' },
  }

  return (
    <Link href={`/listings/${listing.id}`}>
      <Card className="group overflow-hidden transition-shadow hover:shadow-md">
        <div className="aspect-video overflow-hidden bg-muted">
          {firstImage ? (
            <img
              src={firstImage.url}
              alt={listing.product?.name ?? ''}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              暫無圖片
            </div>
          )}
        </div>
        <CardContent className="p-3 space-y-1">
          {listing.product && (
            <h3 className="line-clamp-1 text-sm font-medium">{listing.product.name}</h3>
          )}
          {listing.seller && (
            <p className="text-xs text-muted-foreground">{listing.seller.name}</p>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="font-bold text-primary">
              {formatPrice(listing.price, listing.is_price_on_request)}
            </span>
            <Badge variant="outline" className="text-xs">
              {formatShippingDays(listing.shipping_days)}
            </Badge>
          </div>
          {showStatus && (
            <Badge variant={statusLabels[listing.status]?.variant ?? 'secondary'} className="text-xs">
              {statusLabels[listing.status]?.label ?? listing.status}
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
