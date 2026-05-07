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
    start_date: string
    end_date: string
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
        <CardContent className="flex flex-1 flex-col p-4 min-h-0">
          {/* Title + Location + Date */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">{formatDate(connection.start_date)} ~ {formatDate(connection.end_date)}</span>
            {connection.title && (
              <h3 className="text-base font-bold leading-snug line-clamp-1" style={{ fontFamily: 'var(--font-sans-tc), "微软雅黑", "Microsoft YaHei", sans-serif' }}>{connection.title}</h3>
            )}
            <div className="flex items-center gap-1 text-sm">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="font-medium truncate text-sm">
                {connection.region?.name}
                {connection.locations && connection.locations.length > 0 && ` · ${connection.locations.slice(0, 2).join('・')}${connection.locations.length > 2 ? ` +${connection.locations.length - 2}` : ''}`}
              </span>
            </div>
          </div>

          {/* Description */}
          <p className="mt-2.5 line-clamp-2 text-xs text-gray-700 min-h-[2rem]">
            {connection.description ?? ''}
          </p>

          {/* Seller */}
          {connection.seller && (
            <div className="mt-auto flex items-center gap-2 pt-3 pb-1">
              <Avatar className="h-7 w-7">
                <AvatarImage src={connection.seller.avatar_url ?? connection.seller.profile?.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">{connection.seller.name[0]}</AvatarFallback>
              </Avatar>
              <span className="text-sm truncate">{connection.seller.name}</span>
              {connection.seller.is_social_verified && <SocialBadge className="h-3.5 w-3.5 text-primary" />}
            </div>
          )}
        </CardContent>
      </div>
    </Card>
    </Link>
  )
}
