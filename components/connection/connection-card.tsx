import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SocialBadge } from '@/components/seller/social-badge'
import { formatDate } from '@/lib/utils/format'

interface ConnectionCardProps {
  connection: {
    id: string
    title?: string | null
    start_date: string | null
    end_date: string | null
    shipping_date?: string | null
    locations?: string[] | null
    description?: string | null
    billing_method?: string | null
    post_link?: string | null
    region?: { id: string; name: string } | null
    seller?: {
      id: string
      name: string
      is_social_verified: boolean
      avatar_url?: string | null
      profile?: { display_name: string; avatar_url?: string | null } | null
    } | null
    connection_images?: { url: string; thumbnail_url?: string | null; sort_order: number }[]
  }
}

export function ConnectionCard({ connection }: ConnectionCardProps) {
  const firstImage = connection.connection_images?.sort((a, b) => a.sort_order - b.sort_order)[0]
  const imageUrl = firstImage?.thumbnail_url ?? firstImage?.url ?? null

  return (
    <Link href={`/connections/${connection.id}`} aria-label={connection.title ?? '查看連線代購詳情'}>
    <Card className="group flex flex-col gap-0 overflow-hidden rounded-none py-0 ring-0 shadow-none md:rounded-2xl md:shadow-[0_2px_12px_rgba(15,23,42,0.08)] md:transition-shadow md:hover:shadow-lg">
      <div className="flex h-full flex-col">
        <div className="aspect-square w-full shrink-0 overflow-hidden bg-muted md:aspect-auto md:h-[180px]">
          {imageUrl && (
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          )}
        </div>
        <CardContent className="flex flex-1 flex-col px-2.5 py-2.5 min-h-0 md:p-4">
          {/* Mobile: minimal */}
          <span className="hidden text-text-muted md:block md:text-xs">{formatDate(connection.start_date)} ~ {formatDate(connection.end_date)}</span>
          <h3 className="mt-0.5 text-[14px] font-medium leading-snug line-clamp-2 min-h-[2lh] md:mt-0 md:text-base md:font-bold md:leading-snug md:line-clamp-1 md:min-h-0" style={{ fontFamily: 'var(--font-sans-tc), "微软雅黑", "Microsoft YaHei", sans-serif' }}>{connection.title ?? ' '}</h3>
          {/* Location — mobile: inline simple; desktop: chips */}
          <div className="flex items-center gap-0.5 mt-1 md:flex-wrap md:gap-1 md:mt-1.5">
            {connection.region?.name && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary md:text-xs md:mr-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {connection.region.name}
              </span>
            )}
            {/* Desktop-only location chips */}
            <span className="hidden md:contents">
              {connection.locations?.slice(0, 2).map((loc) => (
                <span key={loc} className="rounded-md bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground cursor-default">
                  {loc}
                </span>
              ))}
              {connection.locations && connection.locations.length > 2 && (
                <span className="text-xs text-muted-foreground">
                  +{connection.locations.length - 2}
                </span>
              )}
            </span>
          </div>

          {/* Description — desktop only */}
          <p className="hidden mt-2.5 line-clamp-2 text-xs text-gray-700 min-h-[2rem] md:block">
            {connection.description ?? ''}
          </p>

          {/* Seller */}
          {connection.seller && (
            <div className="mt-2 flex items-center gap-1.5 md:mt-auto md:gap-2 md:pt-3 md:pb-1">
              <Avatar className="h-5 w-5 md:h-7 md:w-7">
                <AvatarImage src={connection.seller.avatar_url ?? connection.seller.profile?.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px] md:text-xs">{connection.seller.name[0]}</AvatarFallback>
              </Avatar>
              <span className="text-[11px] text-text-muted truncate md:text-sm md:font-medium md:text-foreground">{connection.seller.name}</span>
              {connection.seller.is_social_verified && <SocialBadge className="h-2.5 w-2.5 text-primary md:h-3.5 md:w-3.5 hidden md:block" />}
            </div>
          )}
        </CardContent>
      </div>
    </Card>
    </Link>
  )
}
