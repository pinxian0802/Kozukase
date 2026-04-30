import { z } from 'zod'

export const createConnectionInput = z.object({
  region_id: z.string().uuid(),
  locations: z.array(z.string().max(50)).max(10).optional(),
  start_date: z.string(),
  end_date: z.string(),
  shipping_date: z.string(),
  description: z.string().max(500).optional(),
  billing_method: z.string().max(500).optional(),
  brand_ids: z.array(z.string().uuid()).optional(),
})

export const updateConnectionInput = z.object({
  id: z.string().uuid(),
  region_id: z.string().uuid().optional(),
  locations: z.array(z.string().max(50)).max(10).nullable().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  shipping_date: z.string().optional(),
  description: z.string().max(500).nullable().optional(),
  billing_method: z.string().max(500).nullable().optional(),
  brand_ids: z.array(z.string().uuid()).optional(),
})
