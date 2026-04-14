import { z } from 'zod'

export const createConnectionInput = z.object({
  region_id: z.string().uuid(),
  sub_region: z.string().max(100).optional(),
  start_date: z.string(),
  end_date: z.string(),
  description: z.string().max(500).optional(),
})

export const updateConnectionInput = z.object({
  id: z.string().uuid(),
  region_id: z.string().uuid().optional(),
  sub_region: z.string().max(100).nullable().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  description: z.string().max(500).nullable().optional(),
})
