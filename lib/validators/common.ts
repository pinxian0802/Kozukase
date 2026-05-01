import { z } from 'zod'
import { parseSafeHttpUrl } from '@/lib/utils/safe-url'

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
  .trim()
  .refine((value) => parseSafeHttpUrl(value) !== null, { message: '只允許安全的 http(s) 連結' })
