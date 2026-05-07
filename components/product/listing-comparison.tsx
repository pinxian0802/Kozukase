import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { SocialBadge } from '@/components/seller/social-badge'
import { formatPrice, formatShippingDate } from '@/lib/utils/format'

interface Listing {
  id: string
  title?: string | null
  price: number | null
  is_price_on_request: boolean
  shipping_date: string | null
  specs: any[] | null
  listing_images: { url: string; thumbnail_url?: string | null; sort_order: number }[]
  seller: {
    id: string
    name: string
    avg_rating: number | null
    review_count: number
    is_social_verified: boolean
    avatar_url?: string | null
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
      <p className="py-8 text-center text-muted-foreground">目前沒有符合條件的代購</p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {listings.map((listing) => {
        const firstImage = listing.listing_images?.sort((a, b) => a.sort_order - b.sort_order)[0]
        const imageUrl = firstImage?.thumbnail_url ?? firstImage?.url ?? null

        return (
          <Link key={listing.id} href={`/listings/${listing.id}`} aria-label="查看代購詳情">
            <Card className="group flex flex-col gap-0 overflow-hidden rounded-2xl py-0 ring-0 shadow-[0_2px_12px_rgba(15,23,42,0.08)] transition-shadow hover:shadow-lg">
              <div className="flex h-full flex-col">
                <div className="h-[180px] w-full shrink-0 overflow-hidden bg-muted">
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  )}
                </div>

                <CardContent className="flex flex-1 flex-col p-4">
                  <div className="flex flex-col gap-1.5">
                    {listing.shipping_date && (
                      <span className="text-xs text-muted-foreground">
                        出貨 {formatShippingDate(listing.shipping_date)}
                      </span>
                    )}
                    {listing.title && (
                      <h3 className="line-clamp-1 text-base font-bold leading-snug" style={{ fontFamily: 'var(--font-sans-tc), "微软雅黑", "Microsoft YaHei", sans-serif' }}>
                        {listing.title}
                      </h3>
                    )}
                    <span className="text-xl font-semibold leading-tight">
                      {formatPrice(listing.price, listing.is_price_on_request)}
                    </span>
                  </div>

                  {listing.specs && listing.specs.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {listing.specs.slice(0, 3).map((spec: any, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {spec.type}{!spec.is_all && spec.options?.length > 0 ? `：${spec.options.slice(0, 2).join('/')}` : ''}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto flex items-center gap-2 pt-3 pb-1">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={listing.seller.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">{listing.seller.name[0]}</AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm">{listing.seller.name}</span>
                    {listing.seller.is_social_verified && <SocialBadge className="h-3.5 w-3.5 text-primary" />}
                  </div>
                </CardContent>
              </div>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
