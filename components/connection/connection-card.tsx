import Link from 'next/link'
import { MapPin, Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SocialBadge } from '@/components/seller/social-badge'
import { formatDate } from '@/lib/utils/format'

interface ConnectionCardProps {
  connection: {
    id: string
    start_date: string
    end_date: string
    sub_region?: string | null
    description?: string | null
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
    <Link href={connection.seller ? `/sellers/${connection.seller.id}` : '#'}>
      <Card className="group overflow-hidden transition-shadow hover:shadow-md">
        {imageUrl && (
          <div className="aspect-video overflow-hidden bg-muted">
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
        )}
        <CardContent className="p-4 space-y-2">
          {/* Location */}
          <div className="flex items-center gap-1 text-sm">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="font-medium">
              {connection.region?.name}
              {connection.sub_region && ` · ${connection.sub_region}`}
            </span>
          </div>

          {/* Date */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(connection.start_date)} ~ {formatDate(connection.end_date)}</span>
          </div>

          {/* Description */}
          {connection.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{connection.description}</p>
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
      </Card>
    </Link>
  )
}
