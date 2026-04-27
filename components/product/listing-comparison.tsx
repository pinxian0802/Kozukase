import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StarRating } from '@/components/shared/star-rating'
import { SocialBadge } from '@/components/seller/social-badge'
import { formatPrice, formatShippingDays } from '@/lib/utils/format'

interface Listing {
  id: string
  price: number | null
  is_price_on_request: boolean
  shipping_days: number
  specs: any[] | null
  listing_images: { url: string; thumbnail_url?: string | null; sort_order: number }[]
  seller: {
    id: string
    name: string
    avg_rating: number | null
    review_count: number
    is_social_verified: boolean
    ig_handle?: string | null
    threads_handle?: string | null
  }
}

interface ListingComparisonProps {
  listings: Listing[]
}

export function ListingComparison({ listings }: ListingComparisonProps) {
  if (listings.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">目前沒有賣家上架此商品</p>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing) => {
        const firstImage = listing.listing_images?.sort((a, b) => a.sort_order - b.sort_order)[0]
        const imageUrl = firstImage?.thumbnail_url ?? firstImage?.url ?? null
        return (
          <Link key={listing.id} href={`/listings/${listing.id}`}>
            <Card className="group h-full overflow-hidden transition-shadow hover:shadow-md">
              {imageUrl && (
                <div className="aspect-video overflow-hidden bg-muted">
                  <img
                    src={imageUrl}
                    alt=""
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                </div>
              )}
              <CardContent className="p-4 space-y-3">
                {/* Seller info */}
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{listing.seller.name}</span>
                  {listing.seller.is_social_verified && <SocialBadge />}
                </div>

                {/* Rating */}
                {listing.seller.avg_rating != null && (
                  <div className="flex items-center gap-2">
                    <StarRating value={listing.seller.avg_rating} readonly size="sm" />
                    <span className="text-xs text-muted-foreground">
                      ({listing.seller.review_count})
                    </span>
                  </div>
                )}

                {/* Price & shipping */}
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-primary">
                    {formatPrice(listing.price, listing.is_price_on_request)}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {formatShippingDays(listing.shipping_days)}
                  </Badge>
                </div>

                {/* Specs summary */}
                {listing.specs && listing.specs.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {listing.specs.slice(0, 3).map((spec: any, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {spec.type}: {spec.is_all ? '都有' : spec.options?.slice(0, 2).join('/')}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
