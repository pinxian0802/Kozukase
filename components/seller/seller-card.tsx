import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { StarRating } from '@/components/shared/star-rating'
import { SocialBadge } from '@/components/seller/social-badge'

interface SellerCardProps {
  seller: {
    id: string
    name: string
    avg_rating: number | null
    review_count: number
    is_social_verified: boolean
    ig_handle?: string | null
    threads_handle?: string | null
    profile?: { display_name: string; avatar_url?: string | null } | null
  }
}

export function SellerCard({ seller }: SellerCardProps) {
  return (
    <Link href={`/sellers/${seller.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center gap-4 p-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={seller.profile?.avatar_url ?? undefined} />
            <AvatarFallback>{seller.name[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium truncate">{seller.name}</h3>
              {seller.is_social_verified && <SocialBadge />}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {seller.avg_rating != null ? (
                <>
                  <StarRating value={seller.avg_rating} readonly size="sm" />
                  <span className="text-xs text-muted-foreground">({seller.review_count})</span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">尚無評價</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
