import { z } from 'zod'

export const createReviewInput = z.object({
  seller_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
})

export const replyReviewInput = z.object({
  review_id: z.string().uuid(),
  seller_reply: z.string().min(1).max(1000),
})
