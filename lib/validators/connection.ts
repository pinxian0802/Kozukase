import { z } from 'zod'
import { parseSafeHttpUrl } from '@/lib/utils/safe-url'

const safeConnectionLink = z
  .string()
  .trim()
  .max(500)
  .refine((value) => parseSafeHttpUrl(value) !== null, { message: '只允許安全的 http(s) 連結' })

export const createConnectionInput = z.object({
  title: z.string().min(1).max(30),
  region_id: z.string().uuid(),
  locations: z.array(z.string().max(50)).max(10).optional(),
  start_date: z.string(),
  end_date: z.string(),
  shipping_date: z.string(),
  description: z.string().max(500).optional(),
  billing_method: z.string().max(500).optional(),
  post_link: safeConnectionLink.optional(),
  brand_ids: z.array(z.string().uuid()).optional(),
})

export const updateConnectionInput = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(30).optional(),
  region_id: z.string().uuid().optional(),
  locations: z.array(z.string().max(50)).max(10).nullable().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  shipping_date: z.string().optional(),
  description: z.string().max(500).nullable().optional(),
  billing_method: z.string().max(500).nullable().optional(),
  post_link: safeConnectionLink.nullable().optional(),
  brand_ids: z.array(z.string().uuid()).optional(),
})
