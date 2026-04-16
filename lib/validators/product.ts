import { z } from 'zod'

export const productCategoryEnum = z.enum([
  'fashion', 'beauty', 'food', 'electronics',
  'lifestyle', 'toys', 'limited', 'other',
])

export const createProductInput = z.object({
  name: z.string().min(1, '商品名稱為必填').max(200),
  brand: z.string().max(100).optional(),
  model_number: z.string().max(100).optional(),
})

export const searchProductsInput = z.object({
  query: z.string().min(1).max(200),
  limit: z.number().min(1).max(20).default(20),
})

export const browseProductsInput = z.object({
  query: z.string().max(200).optional(),
  category: productCategoryEnum.optional(),
  region: z.string().uuid().optional(),
  priceMin: z.number().min(0).optional(),
  priceMax: z.number().min(0).optional(),
  shippingDaysMax: z.number().min(1).optional(),
  socialVerifiedOnly: z.boolean().optional(),
  sort: z.enum(['latest', 'price_asc']).default('latest'),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(50).default(20),
})

export type ProductCategory = z.infer<typeof productCategoryEnum>
