import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'

export const messageRouter = router({
  getOrCreate: protectedProcedure
    .input(z.object({ seller_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.seller_id === ctx.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '不能和自己私訊' })
      }

      const { data: seller } = await ctx.db
        .from('sellers')
        .select('id')
        .eq('id', input.seller_id)
        .maybeSingle()

      if (!seller) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '找不到賣家' })
      }

      const { data: existing } = await ctx.db
        .from('conversations')
        .select('*')
        .eq('buyer_id', ctx.user.id)
        .eq('seller_id', input.seller_id)
        .maybeSingle()

      if (existing) return existing

      const { data, error } = await ctx.db
        .from('conversations')
        .insert({ buyer_id: ctx.user.id, seller_id: input.seller_id })
        .select()
        .single()

      if (error) throw error
      return data
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.db
      .from('conversations')
      .select(`
        id, buyer_id, seller_id,
        buyer_last_read_at, seller_last_read_at,
        last_message_at, last_message_preview,
        buyer_profile:profiles!conversations_buyer_id_fkey(id, display_name, avatar_url),
        seller_profile:profiles!conversations_seller_id_fkey(id, display_name, avatar_url)
      `)
      .or(`buyer_id.eq.${ctx.user.id},seller_id.eq.${ctx.user.id}`)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (error) throw error
    const convs = data ?? []

    if (convs.length === 0) return []

    const { data: counts } = await ctx.db.rpc('get_unread_counts', {
      p_user_id: ctx.user.id,
      p_conversation_ids: convs.map(c => c.id),
    })
    const countMap = new Map((counts ?? []).map((r: { conversation_id: string; unread_count: number }) => [r.conversation_id, Number(r.unread_count)]))

    return convs.map(c => ({ ...c, unread_count: countMap.get(c.id) ?? 0 }))
  }),

  messages: protectedProcedure
    .input(z.object({ conversation_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: conv } = await ctx.db
        .from('conversations')
        .select('id')
        .eq('id', input.conversation_id)
        .or(`buyer_id.eq.${ctx.user.id},seller_id.eq.${ctx.user.id}`)
        .maybeSingle()

      if (!conv) throw new TRPCError({ code: 'FORBIDDEN' })

      const { data, error } = await ctx.db
        .from('messages')
        .select('*')
        .eq('conversation_id', input.conversation_id)
        .order('created_at', { ascending: true })
        .limit(50)

      if (error) throw error
      return data ?? []
    }),

  send: protectedProcedure
    .input(
      z.object({
        conversation_id: z.string().uuid(),
        body: z.string().trim().min(1).optional(),
        image_url: z.string().url().optional(),
        context_type: z.enum(['listing', 'connection']).optional(),
        context_id: z.string().uuid().optional(),
        context_label: z.string().optional(),
        context_image_url: z.string().url().optional(),
      }).refine(d => d.body !== undefined || d.image_url !== undefined, {
        message: '訊息內容或圖片擇一必填',
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data: conv } = await ctx.db
        .from('conversations')
        .select('buyer_id, seller_id')
        .eq('id', input.conversation_id)
        .or(`buyer_id.eq.${ctx.user.id},seller_id.eq.${ctx.user.id}`)
        .maybeSingle()

      if (!conv) throw new TRPCError({ code: 'FORBIDDEN' })

      const { data: msg, error: msgErr } = await ctx.db
        .from('messages')
        .insert({
          conversation_id: input.conversation_id,
          sender_id: ctx.user.id,
          body: input.body ?? null,
          image_url: input.image_url ?? null,
          context_type: input.context_type ?? null,
          context_id: input.context_id ?? null,
          context_label: input.context_label ?? null,
          context_image_url: input.context_image_url ?? null,
        })
        .select()
        .single()

      if (msgErr) throw msgErr

      const preview = input.body?.slice(0, 50) ?? '傳送了一張圖片'

      ctx.db
        .from('conversations')
        .update({ last_message_at: msg.created_at, last_message_preview: preview })
        .eq('id', input.conversation_id)
        .then(() => {})

      const recipient_id =
        conv.buyer_id === ctx.user.id ? conv.seller_id : conv.buyer_id

      const { data: profile } = await ctx.db
        .from('profiles')
        .select('display_name')
        .eq('id', ctx.user.id)
        .maybeSingle()

      ctx.db
        .from('notifications')
        .insert({
          recipient_id,
          type: 'new_message' as const,
          payload: {
            conversation_id: input.conversation_id,
            sender_name: profile?.display_name ?? '用戶',
            preview,
          },
        })
        .then(() => {})

      return msg
    }),

  markRead: protectedProcedure
    .input(z.object({ conversation_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: conv } = await ctx.db
        .from('conversations')
        .select('buyer_id, seller_id')
        .eq('id', input.conversation_id)
        .maybeSingle()

      if (!conv) throw new TRPCError({ code: 'NOT_FOUND' })

      const isBuyer = conv.buyer_id === ctx.user.id
      if (!isBuyer && conv.seller_id !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      const field = isBuyer ? 'buyer_last_read_at' : 'seller_last_read_at'

      await ctx.db
        .from('conversations')
        .update({ [field]: new Date().toISOString() })
        .eq('id', input.conversation_id)

      return { success: true }
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const { data: convs } = await ctx.db
      .from('conversations')
      .select('id, buyer_id, buyer_last_read_at, seller_last_read_at')
      .or(`buyer_id.eq.${ctx.user.id},seller_id.eq.${ctx.user.id}`)

    if (!convs?.length) return { count: 0 }

    const results = await Promise.all(
      convs.map(async (conv) => {
        const isBuyer = conv.buyer_id === ctx.user.id
        const lastRead = isBuyer ? conv.buyer_last_read_at : conv.seller_last_read_at

        let q = ctx.db
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', ctx.user.id)

        if (lastRead) q = q.gt('created_at', lastRead)

        const { count } = await q
        return (count ?? 0) > 0 ? 1 : 0
      })
    )

    return { count: results.reduce<number>((a, b) => a + b, 0) }
  }),
})
