'use client'

import { ThumbsUp } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { StarRating } from '@/components/shared/star-rating'
import { formatRelativeTime } from '@/lib/utils/format'
import { trpc } from '@/lib/trpc/client'
import { cn } from '@/lib/utils'

interface Review {
  id: string
  rating: number
  comment: string | null
  seller_reply: string | null
  seller_replied_at: string | null
  like_count: number
  hasLiked?: boolean
  created_at: string
  reviewer?: { id: string; display_name: string; avatar_url?: string | null } | null
}

interface ReviewListProps {
  reviews: Review[]
  sellerId?: string
}

export function ReviewList({ reviews, sellerId }: ReviewListProps) {
  const utils = trpc.useUtils()
  const likeMutation = trpc.review.like.useMutation({
    onSuccess: () => {
      if (sellerId) {
        utils.review.getBySeller.invalidate({ seller_id: sellerId })
      }
    },
  })

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="rounded-lg border p-4 space-y-3">
          {/* Reviewer */}
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={review.reviewer?.avatar_url ?? undefined} />
              <AvatarFallback>{review.reviewer?.display_name?.[0] ?? '?'}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{review.reviewer?.display_name ?? '匿名'}</p>
              <p className="text-xs text-muted-foreground">{formatRelativeTime(review.created_at)}</p>
            </div>
            <div className="ml-auto">
              <StarRating value={review.rating} readonly size="sm" />
            </div>
          </div>

          {/* Comment */}
          {review.comment && (
            <p className="text-sm">{review.comment}</p>
          )}

          {/* Seller reply */}
          {review.seller_reply && (
            <div className="ml-6 rounded-md bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">賣家回覆</p>
              <p className="text-sm">{review.seller_reply}</p>
            </div>
          )}

          {/* Like button */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className={cn('text-xs', review.hasLiked && 'text-primary')}
              onClick={() => likeMutation.mutate({ review_id: review.id })}
              disabled={likeMutation.isPending}
            >
              <ThumbsUp className={cn('mr-1 h-3 w-3', review.hasLiked && 'fill-current')} />
              {review.like_count > 0 ? review.like_count : '讚'}
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
