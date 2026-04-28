import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { httpUrl } from '@/lib/validators/common'

export function buildProfilePayload(user: {
  id: string
  email?: string | null
  user_metadata?: {
    full_name?: string | null
    avatar_url?: string | null
  } | null
}) {
  return {
    id: user.id,
    display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
    avatar_url: user.user_metadata?.avatar_url || null,
  }
}

export const authRouter = router({
  getSession: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return null

    const { data: profile } = await ctx.db
      .from('profiles')
      .select('*, sellers(*)')
      .eq('id', ctx.user.id)
      .maybeSingle()

    if (profile) {
      return {
        user: ctx.user,
        profile,
        isSeller: !!profile.sellers,
        isAdmin: ctx.user.app_metadata?.role === 'admin',
        needsOnboarding: !profile.username,
      }
    }

    const { error: insertError } = await ctx.db
      .from('profiles')
      .insert(buildProfilePayload(ctx.user))

    if (insertError && insertError.code !== '23505') {
      throw insertError
    }

    const { data: createdProfile, error: fetchError } = await ctx.db
      .from('profiles')
      .select('*, sellers(*)')
      .eq('id', ctx.user.id)
      .single()

    if (fetchError) throw fetchError

    return {
      user: ctx.user,
      profile: createdProfile,
      isSeller: !!createdProfile?.sellers,
      isAdmin: ctx.user.app_metadata?.role === 'admin',
      needsOnboarding: !createdProfile?.username,
    }
  }),

  ensureProfile: protectedProcedure.mutation(async ({ ctx }) => {
    const { data: existing } = await ctx.db
      .from('profiles')
      .select('id')
      .eq('id', ctx.user.id)
      .maybeSingle()

    if (existing) return existing

    const { data: profile, error } = await ctx.db
      .from('profiles')
      .insert(buildProfilePayload(ctx.user))
      .select()
      .single()

    if (error) throw error
    return profile
  }),

  checkUsername: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.db
        .from('profiles')
        .select('id')
        .eq('username', input.username)
        .maybeSingle()
      return { available: !data }
    }),

  completeOnboarding: protectedProcedure
    .input(z.object({
      username: z.string().regex(/^[a-z0-9]{3,20}$/, 'username 只能包含小寫英文和數字，長度 3-20'),
      display_name: z.string().min(1, '顯示名稱為必填').max(50),
      avatar_url: httpUrl.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: existing } = await ctx.db
        .from('profiles')
        .select('username')
        .eq('id', ctx.user.id)
        .single()

      if (existing?.username) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '個人資料已設定完成' })
      }

      const { error } = await ctx.db
        .from('profiles')
        .update({
          username: input.username,
          display_name: input.display_name,
          avatar_url: input.avatar_url ?? null,
        })
        .eq('id', ctx.user.id)

      if (error) {
        if (error.code === '23505') {
          throw new TRPCError({ code: 'CONFLICT', message: '此 username 已被使用' })
        }
        throw error
      }

      return { success: true }
    }),

  updateProfile: protectedProcedure
    .input(z.object({
      display_name: z.string().min(1, '顯示名稱為必填').max(50).optional(),
      avatar_url: httpUrl.nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, unknown> = {}
      if (input.display_name !== undefined) updates.display_name = input.display_name
      if (input.avatar_url !== undefined) updates.avatar_url = input.avatar_url

      const { error } = await ctx.db
        .from('profiles')
        .update(updates)
        .eq('id', ctx.user.id)

      if (error) throw error
      return { success: true }
    }),
})
