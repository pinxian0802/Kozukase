import { router, publicProcedure, protectedProcedure } from '../trpc'

export const authRouter = router({
  getSession: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return null
    
    const { data: profile } = await ctx.db
      .from('profiles')
      .select('*, sellers(*)')
      .eq('id', ctx.user.id)
      .single()
    
    return {
      user: ctx.user,
      profile,
      isSeller: !!profile?.sellers,
      isAdmin: ctx.user.app_metadata?.role === 'admin',
    }
  }),

  ensureProfile: protectedProcedure.mutation(async ({ ctx }) => {
    const { data: existing } = await ctx.db
      .from('profiles')
      .select('id')
      .eq('id', ctx.user.id)
      .single()

    if (existing) return existing

    const { data: profile, error } = await ctx.db
      .from('profiles')
      .insert({
        id: ctx.user.id,
        display_name: ctx.user.user_metadata?.full_name || ctx.user.email?.split('@')[0] || 'User',
        avatar_url: ctx.user.user_metadata?.avatar_url || null,
      })
      .select()
      .single()

    if (error) throw error
    return profile
  }),
})
