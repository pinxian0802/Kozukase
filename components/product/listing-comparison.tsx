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
    <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-4">
      {listings.map((listing) => {
        const firstImage = listing.listing_images?.sort((a, b) => a.sort_order - b.sort_order)[0]
        const imageUrl = firstImage?.thumbnail_url ?? firstImage?.url ?? null

        return (
          <Link key={listing.id} href={`/listings/${listing.id}`} aria-label="查看代購詳情">
            {/* Mobile: flat white block; Desktop: card with shadow */}
            <Card className="group flex flex-col gap-0 overflow-hidden rounded-none py-0 ring-0 shadow-none md:rounded-2xl md:shadow-[0_2px_12px_rgba(15,23,42,0.08)] md:transition-shadow md:hover:shadow-lg">
              <div className="flex h-full flex-col">
                <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-muted md:aspect-[4/3]">
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  )}
                  {listing.is_in_stock && (
                    <span className="absolute left-1.5 top-1.5 z-10 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 md:left-3 md:top-3 md:rounded-md md:px-2 md:text-[10px]">
                      現貨
                    </span>
                  )}
                </div>

                <CardContent className="flex flex-1 flex-col px-1.5 py-1.5 md:p-4">
                  <h3 className="line-clamp-2 min-h-[2lh] text-[10px] leading-tight md:line-clamp-1 md:min-h-0 md:text-base md:font-bold md:leading-snug" style={{ fontFamily: 'var(--font-sans-tc), "微软雅黑", "Microsoft YaHei", sans-serif' }}>
                    {listing.title ?? ' '}
                  </h3>

                  {/* Specs — hidden on mobile */}
                  <div className="mt-2.5 hidden min-h-[26px] flex-wrap items-center gap-1 md:flex">
                    {listing.specs && listing.specs.slice(0, 4).map((spec: any, i: number) => (
                      <div key={i} className="group/spec relative">
                        <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground cursor-default">
                          {spec.type}
                        </span>
                        {!spec.is_all && spec.options?.length > 0 && (
                          <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/spec:block z-10">
                            <div className="rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs text-text-inverse shadow-lg whitespace-nowrap">
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

                  <div className="mt-0.5 md:mt-auto md:pt-6">
                    <span className="text-[11px] font-bold leading-tight md:text-xl md:font-semibold" style={{ color: 'var(--brand-700)' }}>
                      {formatPrice(listing.price, listing.is_price_on_request)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 mt-1 md:gap-2 md:pt-1.5">
                    <Avatar className="h-3.5 w-3.5 shrink-0 md:h-6 md:w-6">
                      <AvatarImage src={listing.seller.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[7px] md:text-xs">{listing.seller.name[0]}</AvatarFallback>
                    </Avatar>
                    <span className="truncate text-[9px] text-neutral-400 md:hidden">{listing.seller.name}</span>
                    <div className="min-w-0 flex-1 hidden md:block">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-sm font-medium text-text-strong">{listing.seller.name}</span>
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
