import Link from 'next/link'
import { MapPin, Calendar } from 'lucide-react'
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
      profile?: { display_name: string; avatar_url?: string | null } | null
    } | null
    connection_images?: { url: string; thumbnail_url?: string | null; sort_order: number }[]
  }
}

export function ConnectionCard({ connection }: ConnectionCardProps) {
  const firstImage = connection.connection_images?.sort((a, b) => a.sort_order - b.sort_order)[0]
  const imageUrl = firstImage?.thumbnail_url ?? firstImage?.url ?? null

  return (
    <Card className="group relative flex h-[360px] flex-col overflow-hidden py-0 transition-shadow hover:shadow-md">
      {connection.seller && (
        <Link
          href={`/sellers/${connection.seller.id}`}
          aria-label={`前往 ${connection.seller.name} 的賣家頁面`}
          className="absolute inset-0 z-0"
        />
      )}
      <div className="relative z-10 flex h-full flex-col">
        <div className="h-40 shrink-0 overflow-hidden bg-muted">
          {imageUrl && (
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          )}
        </div>
        <CardContent className="flex flex-1 flex-col gap-1.5 p-4 min-h-0">
          {/* Title */}
          {connection.title && (
            <h3 className="text-base font-semibold leading-tight line-clamp-1">{connection.title}</h3>
          )}

          {/* Location */}
          <div className="flex items-center gap-1 text-sm">
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            <span className="font-medium truncate">
              {connection.region?.name}
              {connection.locations && connection.locations.length > 0 && ` · ${connection.locations.slice(0, 2).join('・')}${connection.locations.length > 2 ? ` +${connection.locations.length - 2}` : ''}`}
            </span>
          </div>

          {/* Date */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3 shrink-0" />
            <span>{formatDate(connection.start_date)} ~ {formatDate(connection.end_date)}</span>
          </div>

          {/* Description */}
          <div className="flex-1 overflow-hidden">
            {connection.description && (
              <p className="line-clamp-3 text-sm text-black">{connection.description}</p>
            )}
          </div>

          {/* Seller */}
          {connection.seller && (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={connection.seller.profile?.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">{connection.seller.name[0]}</AvatarFallback>
              </Avatar>
              <span className="text-sm truncate">{connection.seller.name}</span>
              {connection.seller.is_social_verified && <SocialBadge />}
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  )
}
