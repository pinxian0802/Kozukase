import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { router, protectedProcedure } from '../trpc'

// Single source of truth for "is this conversation mine?". Backend uses the
// service-role key, which bypasses RLS — so every conversation-scoped action
// must guard membership in code. Route all such checks through here.
async function getConversationAsMember(
  db: SupabaseClient,
  conversationId: string,
  userId: string,
) {
  const { data: conv } = await db
    .from('conversations')
    .select('id, buyer_id, seller_id')
    .eq('id', conversationId)
    .maybeSingle()

  if (!conv) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到對話' })
  if (conv.buyer_id !== userId && conv.seller_id !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN' })
  }
  return conv
}

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

      // Check both directions — the other party may have initiated first
      const { data: existing } = await ctx.db
        .from('conversations')
        .select('*')
        .or(
          `and(buyer_id.eq.${ctx.user.id},seller_id.eq.${input.seller_id}),` +
          `and(buyer_id.eq.${input.seller_id},seller_id.eq.${ctx.user.id})`
        )
        .maybeSingle()

      if (existing) return existing

      const { data, error } = await ctx.db
        .from('conversations')
        .insert({ buyer_id: ctx.user.id, seller_id: input.seller_id })
        .select()
        .single()

      // Race condition or pre-existing duplicate: fetch whichever direction exists
      if (error) {
        if (error.code === '23505') {
          const { data: fallback } = await ctx.db
            .from('conversations')
            .select('*')
            .or(
              `and(buyer_id.eq.${ctx.user.id},seller_id.eq.${input.seller_id}),` +
              `and(buyer_id.eq.${input.seller_id},seller_id.eq.${ctx.user.id})`
            )
            .limit(1)
            .single()
          if (fallback) return fallback
        }
        throw error
      }
      return data
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.db
      .from('conversations')
      .select(`
        id, buyer_id, seller_id,
        buyer_last_read_at, seller_last_read_at,
        last_message_at, last_message_preview,
        buyer_profile:profiles!conversations_buyer_id_fkey(id, display_name, avatar_url, last_seen_at),
        seller_profile:profiles!conversations_seller_id_fkey(id, display_name, avatar_url, last_seen_at, seller_identity:sellers(name, avatar_url))
      `)
      .or(`buyer_id.eq.${ctx.user.id},and(seller_id.eq.${ctx.user.id},last_message_at.not.is.null)`)
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
    .input(z.object({
      conversation_id: z.string().uuid(),
      before: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await getConversationAsMember(ctx.db, input.conversation_id, ctx.user.id)

      let q = ctx.db
        .from('messages')
        .select('*')
        .eq('conversation_id', input.conversation_id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (input.before) {
        q = q.lt('created_at', input.before)
      }

      const { data, error } = await q
      if (error) throw error

      const msgs = data ?? []
      return {
        messages: [...msgs].reverse(),
        hasMore: msgs.length === 50,
      }
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
      const r2Base = process.env.R2_PUBLIC_URL
      if (input.image_url && (!r2Base || !input.image_url.startsWith(r2Base))) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '圖片必須來自受信任的儲存空間' })
      }
      if (input.context_image_url && (!r2Base || !input.context_image_url.startsWith(r2Base))) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '圖片必須來自受信任的儲存空間' })
      }

      const conv = await getConversationAsMember(ctx.db, input.conversation_id, ctx.user.id)

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

      const nowIso = new Date().toISOString()
      const preview = input.body?.slice(0, 50) ?? '傳送了一張圖片'
      const isBuyer = conv.buyer_id === ctx.user.id
      const readField = isBuyer ? 'buyer_last_read_at' : 'seller_last_read_at'

      // Message is already saved — these are follow-up updates. Await them so they
      // actually run (fire-and-forget can be killed when a serverless response returns),
      // but never fail the send: log and still return the saved message.
      const { error: convErr } = await ctx.db
        .from('conversations')
        .update({
          last_message_at: msg.created_at,
          last_message_preview: preview,
          [readField]: nowIso,
        })
        .eq('id', input.conversation_id)
      if (convErr) console.error('更新對話摘要失敗', convErr)

      const { error: seenErr } = await ctx.db
        .from('profiles')
        .update({ last_seen_at: nowIso })
        .eq('id', ctx.user.id)
      if (seenErr) console.error('更新上線時間失敗', seenErr)

      // ────────────────────────────────────────────────────────
      // Realtime broadcast (best-effort)
      // 訊息已存進 DB,以下廣播只是「即時推播」;失敗不影響送出結果,
      // 對方下次切頁或 staleTime 過期會看到訊息。
      // ────────────────────────────────────────────────────────
      const recipientId = isBuyer ? conv.seller_id : conv.buyer_id

      try {
        const convChannel = ctx.db.channel(
          `conversation:${input.conversation_id}`,
          { config: { private: true } }
        )
        const result = await convChannel.send({
          type: 'broadcast',
          event: 'new_message',
          payload: msg,
        })
        if (result !== 'ok') {
          console.error('廣播到對話頻道未成功', { result, conversation_id: input.conversation_id })
        }
      } catch (err) {
        console.error('廣播到對話頻道拋錯', err)
      }

      try {
        const userChannel = ctx.db.channel(
          `user:${recipientId}`,
          { config: { private: true } }
        )
        const result = await userChannel.send({
          type: 'broadcast',
          event: 'messages_changed',
          payload: { conversation_id: input.conversation_id },
        })
        if (result !== 'ok') {
          console.error('廣播到使用者頻道未成功', { result, recipient_id: recipientId })
        }
      } catch (err) {
        console.error('廣播到使用者頻道拋錯', err)
      }

      return msg
    }),

  markRead: protectedProcedure
    .input(z.object({ conversation_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const conv = await getConversationAsMember(ctx.db, input.conversation_id, ctx.user.id)

      const isBuyer = conv.buyer_id === ctx.user.id
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
      .select('id')
      .or(`buyer_id.eq.${ctx.user.id},seller_id.eq.${ctx.user.id}`)

    if (!convs?.length) return { count: 0 }

    const { data: counts } = await ctx.db.rpc('get_unread_counts', {
      p_user_id: ctx.user.id,
      p_conversation_ids: convs.map((c: { id: string }) => c.id),
    })

    return {
      count: (counts ?? []).filter((r: { unread_count: number }) => Number(r.unread_count) > 0).length,
    }
  }),
})
