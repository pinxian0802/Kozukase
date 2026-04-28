import { z } from 'zod'

export const cursorPaginationInput = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(50).default(20),
})

export const idParam = z.object({
  id: z.string().uuid(),
})

export type CursorPaginationInput = z.infer<typeof cursorPaginationInput>

export const httpUrl = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), { message: '只允許 http(s) 連結' })
