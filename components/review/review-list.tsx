'use client'

import { useState } from 'react'
import { ThumbsUp, MoreVertical, Flag } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { StarRating } from '@/components/shared/star-rating'
import { ReportDialog } from '@/components/shared/report-dialog'
import { formatRelativeTime } from '@/lib/utils/format'
import { trpc } from '@/lib/trpc/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

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
  /** 目前登入者是否為此賣家本人（決定能否回覆評價） */
  canReply?: boolean
}

export function ReviewList({ reviews, sellerId, canReply = false }: ReviewListProps) {
  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} sellerId={sellerId} canReply={canReply} />
      ))}
    </div>
  )
}

function ReviewCard({
  review,
  sellerId,
  canReply,
}: {
  review: Review
  sellerId?: string
  canReply: boolean
}) {
  const utils = trpc.useUtils()
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState(review.seller_reply ?? '')
  const [reportOpen, setReportOpen] = useState(false)

  const invalidate = () => {
    if (sellerId) utils.review.getBySeller.invalidate({ seller_id: sellerId })
  }

  const likeMutation = trpc.review.like.useMutation({ onSuccess: invalidate })
  const replyMutation = trpc.review.reply.useMutation({
    onSuccess: () => {
      toast.success('已回覆')
      setReplyOpen(false)
      invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  const submitReply = () => {
    const text = replyText.trim()
    if (!text) {
      toast.error('請輸入回覆內容')
      return
    }
    replyMutation.mutate({ review_id: review.id, seller_reply: text })
  }

  return (
    <div data-testid="review-item" data-id={review.id} className="rounded-[14px] border border-border-soft p-4 space-y-3">
      {/* Reviewer */}
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={review.reviewer?.avatar_url ?? undefined} />
          <AvatarFallback>{review.reviewer?.display_name?.[0] ?? '?'}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">{review.reviewer?.display_name ?? '匿名'}</p>
          <p className="text-xs text-text-muted">{formatRelativeTime(review.created_at)}</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <StarRating value={review.rating} readonly size="sm" />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="更多操作" className="text-text-muted">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem variant="destructive" onClick={() => setReportOpen(true)}>
                <Flag className="h-4 w-4" />檢舉
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ReportDialog review_id={review.id} open={reportOpen} onOpenChange={setReportOpen} hideTrigger />
        </div>
      </div>

      {/* Comment */}
      {review.comment && (
        <p className="text-sm">{review.comment}</p>
      )}

      {/* Seller reply */}
      {review.seller_reply && (
        <div className="ml-6 rounded-md bg-surface-muted p-3">
          <p className="text-xs font-medium text-text-muted mb-1">賣家回覆</p>
          <p className="text-sm">{review.seller_reply}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          className={cn('text-xs', review.hasLiked && 'text-primary')}
          onClick={() => likeMutation.mutate({ review_id: review.id })}
          disabled={likeMutation.isPending}
        >
          <ThumbsUp className={cn('mr-1 h-3 w-3', review.hasLiked && 'fill-current')} />
          {review.like_count > 0 ? review.like_count : '讚'}
        </Button>
        {canReply && (
          <Button
            variant="ghost"
            className="text-xs"
            onClick={() => {
              setReplyText(review.seller_reply ?? '')
              setReplyOpen((v) => !v)
            }}
          >
            {review.seller_reply ? '編輯回覆' : '回覆'}
          </Button>
        )}
      </div>

      {/* Reply editor */}
      {canReply && replyOpen && (
        <div className="space-y-2">
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="回覆這則評價"
            rows={2}
            maxLength={1000}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={submitReply} disabled={replyMutation.isPending}>
              {replyMutation.isPending ? '送出中...' : '送出回覆'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReplyOpen(false)} disabled={replyMutation.isPending}>
              取消
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
