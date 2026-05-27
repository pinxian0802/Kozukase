'use client'

import { useState } from 'react'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { FormFieldError } from '@/components/shared/form-field-error'
import { StarRating } from '@/components/shared/star-rating'
import { formatRelativeTime } from '@/lib/utils/format'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'

interface MyReview {
  id: string
  rating: number
  comment: string | null
  created_at: string
}

function useReviewInvalidate(sellerId: string) {
  const utils = trpc.useUtils()
  return () => {
    utils.review.getBySeller.invalidate({ seller_id: sellerId })
    utils.review.getDistribution.invalidate({ seller_id: sellerId })
    utils.review.getMyReviewForSeller.invalidate({ seller_id: sellerId })
    utils.seller.getById.invalidate({ id: sellerId })
  }
}

function ReviewEditor({
  sellerId,
  myReview,
  onDone,
}: {
  sellerId: string
  myReview: MyReview | null
  onDone: () => void
}) {
  const invalidate = useReviewInvalidate(sellerId)
  const [rating, setRating] = useState(myReview?.rating ?? 0)
  const [comment, setComment] = useState(myReview?.comment ?? '')
  const [ratingError, setRatingError] = useState('')

  const createReview = trpc.review.create.useMutation({
    onSuccess: () => { toast.success('評價已送出'); invalidate(); onDone() },
    onError: (err) => toast.error(err.message),
  })
  const updateReview = trpc.review.update.useMutation({
    onSuccess: () => { toast.success('評價已更新'); invalidate(); onDone() },
    onError: (err) => toast.error(err.message),
  })

  const isEditing = !!myReview
  const pending = createReview.isPending || updateReview.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (rating === 0) {
      setRatingError('請選擇星等')
      return
    }
    setRatingError('')
    const commentValue = comment.trim() || undefined
    if (isEditing && myReview) {
      updateReview.mutate({ review_id: myReview.id, rating, comment: commentValue })
    } else {
      createReview.mutate({ seller_id: sellerId, rating, comment: commentValue })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-[14px] border border-border-soft p-4" noValidate>
      <h3 className="font-medium">{isEditing ? '編輯評價' : '撰寫評價'}</h3>
      <div>
        <p className="mb-2 text-sm text-text-muted">評分</p>
        <StarRating
          value={rating}
          onChange={(value) => {
            setRating(value)
            if (ratingError) setRatingError('')
          }}
          size="lg"
        />
        <FormFieldError message={ratingError} />
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="分享你的代購體驗（選填）"
        rows={3}
        maxLength={1000}
      />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className={buttonVariants()}>
          {pending ? '送出中...' : isEditing ? '儲存修改' : '送出評價'}
        </button>
        {isEditing && (
          <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
            取消
          </Button>
        )}
      </div>
    </form>
  )
}

interface ReviewComposerProps {
  sellerId: string
  isOwnProfile: boolean
  isLoggedIn: boolean
  myReview: MyReview | null
}

export function ReviewComposer({ sellerId, isOwnProfile, isLoggedIn, myReview }: ReviewComposerProps) {
  const invalidate = useReviewInvalidate(sellerId)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const removeReview = trpc.review.remove.useMutation({
    onSuccess: () => {
      toast.success('評價已刪除')
      setConfirmDelete(false)
      invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  // 賣家本人看自己頁面：不顯示評價表單（不能評價自己）
  if (isOwnProfile) return null

  // 未登入：引導登入
  if (!isLoggedIn) {
    return (
      <div className="rounded-[14px] border border-border-soft p-4 text-sm text-text-muted">
        <a href="/login" className="font-medium text-primary underline">登入</a> 後即可撰寫評價
      </div>
    )
  }

  // 已留過評價且不在編輯狀態：顯示「你的評價」，可編輯 / 刪除
  if (myReview && !editing) {
    return (
      <div className="rounded-[14px] border border-border-soft p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <h3 className="font-medium">你的評價</h3>
          <StarRating value={myReview.rating} readonly size="sm" />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="更多操作" className="ml-auto text-text-muted">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" />編輯
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="mr-2 h-4 w-4" />刪除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {myReview.comment && <p className="text-sm">{myReview.comment}</p>}
        <p className="text-xs text-text-muted">{formatRelativeTime(myReview.created_at)}</p>
        {confirmDelete && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-muted">確定刪除？</span>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => removeReview.mutate({ review_id: myReview.id })}
              disabled={removeReview.isPending}
            >
              確認刪除
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={removeReview.isPending}>
              取消
            </Button>
          </div>
        )}
      </div>
    )
  }

  // 撰寫新評價，或編輯既有評價
  return (
    <ReviewEditor
      sellerId={sellerId}
      myReview={editing ? myReview : null}
      onDone={() => setEditing(false)}
    />
  )
}
