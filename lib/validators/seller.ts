import { z } from 'zod'
import { httpUrl } from './common'

export const becomeSellerInput = z.object({
  name: z.string().min(1, '賣家名稱為必填').max(50),
  phone_number: z.string().min(8, '請輸入有效的手機號碼').max(20),
  region_ids: z.array(z.string().uuid()).min(1, '請至少選擇一個代購地區'),
  bio: z.string().max(300).optional(),
  avatar_url: httpUrl.optional(),
})

export const updateSellerInput = z.object({
  name: z.string().min(1).max(50).optional(),
  region_ids: z.array(z.string().uuid()).min(1).optional(),
  bio: z.string().max(300).optional(),
  avatar_url: httpUrl.nullable().optional(),
})
