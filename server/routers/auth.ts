import { router, publicProcedure, protectedProcedure } from '../trpc'

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
})
