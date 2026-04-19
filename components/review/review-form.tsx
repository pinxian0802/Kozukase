'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FormFieldError } from '@/components/shared/form-field-error'
import { StarRating } from '@/components/shared/star-rating'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'

interface ReviewFormProps {
  sellerId: string
  onSuccess?: () => void
}

export function ReviewForm({ sellerId, onSuccess }: ReviewFormProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [ratingError, setRatingError] = useState('')
  const utils = trpc.useUtils()

  const createReview = trpc.review.create.useMutation({
    onSuccess: () => {
      toast.success('評價已送出')
      setRating(0)
      setComment('')
      utils.review.getBySeller.invalidate({ seller_id: sellerId })
      onSuccess?.()
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (rating === 0) {
      setRatingError('請選擇星等')
      return
    }

    setRatingError('')
    createReview.mutate({
      seller_id: sellerId,
      rating,
      comment: comment.trim() || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4" noValidate>
      <h3 className="font-medium">撰寫評價</h3>
      <div>
        <p className="mb-2 text-sm text-muted-foreground">評分</p>
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
        maxLength={500}
      />
      <button type="submit" disabled={createReview.isPending} className={buttonVariants()}>
        {createReview.isPending ? '送出中...' : '送出評價'}
      </button>
    </form>
  )
}
