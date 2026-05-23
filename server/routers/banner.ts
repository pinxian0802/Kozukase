import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, adminProcedure } from '../trpc'
import { deleteR2Objects } from '@/lib/r2'

const BANNER_KEY_PREFIX = 'images/banner/users/'

// link_url:站內路徑(/...)或 http(s) 絕對網址
const linkUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => v.startsWith('/') || /^https?:\/\//.test(v), {
    message: '連結需為站內路徑(/...)或 http(s) 網址',
  })

export const bannerRouter = router({
  // 首頁用:只回上架的,依順序
  listActive: publicProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.db
      .from('home_banners')
      .select('id, image_url, link_url')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return data ?? []
  }),

  // 後台用:全部
  list: adminProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.db
      .from('home_banners')
      .select('id, image_url, image_r2_key, link_url, is_active, sort_order')
      .order('sort_order', { ascending: true })
    if (error) throw error
    return data ?? []
  }),

  create: adminProcedure
    .input(
      z.object({
        image_url: z.string().url(),
        image_r2_key: z.string().min(1).max(500),
        link_url: linkUrlSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.image_r2_key.includes('..') || !input.image_r2_key.startsWith(BANNER_KEY_PREFIX)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '無效的圖片金鑰' })
      }
      // 接到目前最大 sort_order 之後
      const { data: last } = await ctx.db
        .from('home_banners')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      const nextOrder = (last?.sort_order ?? -1) + 1

      const { data, error } = await ctx.db
        .from('home_banners')
        .insert({
          image_url: input.image_url,
          image_r2_key: input.image_r2_key,
          link_url: input.link_url ?? null,
          sort_order: nextOrder,
          created_by: ctx.user.id,
        })
        .select('id, image_url, image_r2_key, link_url, is_active, sort_order')
        .single()
      if (error) throw error
      return data
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        link_url: linkUrlSchema.nullish(), // null = 清空連結
        is_active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const patch: Record<string, unknown> = {}
      if (input.link_url !== undefined) patch.link_url = input.link_url
      if (input.is_active !== undefined) patch.is_active = input.is_active
      if (Object.keys(patch).length === 0) return { ok: true }

      const { error } = await ctx.db.from('home_banners').update(patch).eq('id', input.id)
      if (error) throw error
      return { ok: true }
    }),

  remove: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: row } = await ctx.db
        .from('home_banners')
        .select('image_r2_key')
        .eq('id', input.id)
        .maybeSingle()

      const { error } = await ctx.db.from('home_banners').delete().eq('id', input.id)
      if (error) throw error

      if (row?.image_r2_key) {
        await deleteR2Objects([row.image_r2_key]) // best-effort,失敗不阻擋
      }
      return { ok: true }
    }),

  reorder: adminProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.ids.map((id, idx) =>
          ctx.db.from('home_banners').update({ sort_order: idx }).eq('id', id),
        ),
      )
      return { ok: true }
    }),
})
