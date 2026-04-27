import { z } from 'zod'

export const productCategoryEnum = z.enum([
  'fashion', 'beauty', 'health', 'food', 'electronics',
  'lifestyle', 'sports', 'toys', 'books', 'pets',
  'culture', 'automotive', 'baby', 'jewelry', 'other',
])

export const createProductInput = z.object({
  name: z.string().min(1, '商品名稱為必填').max(200),
  brand_id: z.string().uuid().optional(),
  model_number: z.string().max(100).optional(),
  category: productCategoryEnum.optional(),
  region_id: z.string().uuid().optional(),
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
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(50).default(20),
})

export type ProductCategory = z.infer<typeof productCategoryEnum>
