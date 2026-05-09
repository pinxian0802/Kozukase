import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SocialBadge } from '@/components/seller/social-badge'
import { formatPrice, formatShippingDate } from '@/lib/utils/format'

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '剛剛'
  if (mins < 60) return `${mins}分鐘前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小時前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}個月前`
  return `${Math.floor(months / 12)}年前`
}

interface Listing {
  id: string
  title?: string | null
  price: number | null
  is_price_on_request: boolean
  is_in_stock: boolean
  shipping_date: string | null
  created_at: string | null
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
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {listings.map((listing) => {
        const firstImage = listing.listing_images?.sort((a, b) => a.sort_order - b.sort_order)[0]
        const imageUrl = firstImage?.thumbnail_url ?? firstImage?.url ?? null

        return (
          <Link key={listing.id} href={`/listings/${listing.id}`} aria-label="查看代購詳情">
            <Card className="group flex flex-col gap-0 overflow-hidden rounded-2xl py-0 ring-0 shadow-[0_2px_12px_rgba(15,23,42,0.08)] transition-shadow hover:shadow-lg">
              <div className="flex h-full flex-col">
                <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-muted">
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  )}
                  {listing.is_in_stock && (
                    <span className="absolute left-3 top-3 z-10 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      有現貨
                    </span>
                  )}
                </div>

                <CardContent className="flex flex-1 flex-col p-4">
                  <div className="flex flex-col gap-1.5">
                    {listing.title && (
                      <h3 className="line-clamp-1 text-base font-bold leading-snug" style={{ fontFamily: 'var(--font-sans-tc), "微软雅黑", "Microsoft YaHei", sans-serif' }}>
                        {listing.title}
                      </h3>
                    )}
                  </div>

                  <div className="mt-2.5 flex min-h-[26px] flex-wrap items-center gap-1">
                    {listing.specs && listing.specs.slice(0, 4).map((spec: any, i: number) => (
                      <div key={i} className="group/spec relative">
                        <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground cursor-default">
                          {spec.type}
                        </span>
                        {!spec.is_all && spec.options?.length > 0 && (
                          <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/spec:block z-10">
                            <div className="rounded-lg bg-[#1a1a1a] px-2.5 py-1.5 text-xs text-white shadow-lg whitespace-nowrap">
                              {spec.options.join('、')}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {listing.specs && listing.specs.length > 4 && (
                      <span className="text-xs text-muted-foreground">+{listing.specs.length - 4}</span>
                    )}
                  </div>

                  <div className="mt-auto pt-6">
                    <span className="text-xl font-semibold leading-tight">
                      {formatPrice(listing.price, listing.is_price_on_request)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1.5">
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarImage src={listing.seller.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">{listing.seller.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-sm font-medium text-[#222]">{listing.seller.name}</span>
                        {listing.seller.is_social_verified && <SocialBadge className="h-3 w-3 shrink-0" />}
                      </div>
                      {listing.created_at && (
                        <p className="text-[11px] leading-tight text-muted-foreground">{timeAgo(listing.created_at)}</p>
                      )}
                    </div>
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
