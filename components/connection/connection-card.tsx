import Link from 'next/link'
import { ExternalLink, MapPin, Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SocialBadge } from '@/components/seller/social-badge'
import { SafeExternalLink } from '@/components/shared/safe-external-link'
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
    <Card className="group relative overflow-hidden transition-shadow hover:shadow-md">
      {connection.seller && (
        <Link
          href={`/sellers/${connection.seller.id}`}
          aria-label={`前往 ${connection.seller.name} 的賣家頁面`}
          className="absolute inset-0 z-0"
        />
      )}
      <div className="relative z-10">
        {imageUrl && (
          <div className="aspect-video overflow-hidden bg-muted">
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
        )}
        <CardContent className="space-y-2 p-4">
          {/* Title */}
          {connection.title && (
            <h3 className="font-semibold leading-tight line-clamp-1">{connection.title}</h3>
          )}

          {/* Location */}
          <div className="flex items-center gap-1 text-sm">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="font-medium">
              {connection.region?.name}
              {connection.locations && connection.locations.length > 0 && ` · ${connection.locations.slice(0, 2).join('・')}${connection.locations.length > 2 ? ` +${connection.locations.length - 2}` : ''}`}
            </span>
          </div>

          {/* Date */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(connection.start_date)} ~ {formatDate(connection.end_date)}</span>
          </div>

          {connection.shipping_date && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>預計出貨：{formatDate(connection.shipping_date)}</span>
            </div>
          )}

          {/* Description */}
          {connection.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{connection.description}</p>
          )}

          {connection.billing_method && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{connection.billing_method}</p>
          )}

          {connection.post_link && (
            <SafeExternalLink href={connection.post_link} variant="ghost" size="sm" className="relative z-20 h-auto px-0 py-0 text-xs text-primary hover:bg-transparent hover:text-primary/80">
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">貼文 / 社群連結</span>
            </SafeExternalLink>
          )}

          {/* Seller */}
          {connection.seller && (
            <div className="flex items-center gap-2 pt-1 border-t">
              <Avatar className="h-6 w-6">
                <AvatarImage src={connection.seller.profile?.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">{connection.seller.name[0]}</AvatarFallback>
              </Avatar>
              <span className="text-sm">{connection.seller.name}</span>
              {connection.seller.is_social_verified && <SocialBadge />}
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  )
}
