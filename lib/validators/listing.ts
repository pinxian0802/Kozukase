import { z } from 'zod'

const listingSpecSchema = z.object({
  type: z.string().min(1),
  is_custom: z.boolean(),
  options: z.array(z.string()),
  is_all: z.boolean(),
})

export const createListingInput = z.object({
  product_id: z.string().uuid(),
  status: z.enum(['draft', 'active']),
  price: z.number().min(0).optional(),
  is_price_on_request: z.boolean().default(false),
  specs: z.array(listingSpecSchema).default([]),
  note: z.string().max(1000).optional(),
  post_url: z.string().url('請提供有效的貼文連結').optional(),
  shipping_days: z.number().min(1).optional(),
  expires_at: z.string().datetime().optional(),
})

export const updateListingInput = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid().optional(),
  price: z.number().min(0).optional(),
  is_price_on_request: z.boolean().optional(),
  specs: z.array(listingSpecSchema).optional(),
  note: z.string().max(1000).optional(),
  post_url: z.string().url().optional(),
  shipping_days: z.number().min(1).optional(),
  expires_at: z.string().datetime().nullable().optional(),
})

export const publishListingInput = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  price: z.number().min(0).optional(),
  is_price_on_request: z.boolean(),
  specs: z.array(listingSpecSchema).default([]),
  note: z.string().max(1000).optional(),
  post_url: z.string().url('請提供有效的貼文連結'),
  shipping_days: z.number().min(1, '出貨天數為必填'),
  expires_at: z.string().datetime().optional(),
}).refine(
  (data) => data.price !== undefined || data.is_price_on_request,
  { message: '請填寫價格或選擇私訊報價', path: ['price'] }
)
