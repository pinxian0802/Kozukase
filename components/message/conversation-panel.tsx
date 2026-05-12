'use client'

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { Info, MoreHorizontal } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { trpc } from '@/lib/trpc/client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useSession } from '@/lib/context/session-context'
import { toast } from 'sonner'
import { MessageBubble } from './message-bubble'
import { MessageInput, type SendPayload } from './message-input'
import type { Message } from '@/server/db/types'

export type DisplayMessage = Message & {
  isOptimistic?: boolean
  localImageUrl?: string
  uploadProgress?: number
}

type Props = {
  conversationId: string
  otherName: string | null
  otherAvatar: string | null
  pendingContext?: {
    contextType?: 'listing' | 'connection'
    contextId?: string
    contextLabel?: string
  }
  pendingContextImage?: string
}

function uploadWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (p: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed: ${xhr.status}`))
    })
    xhr.addEventListener('error', () => reject(new Error('Upload failed')))
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.send(file)
  })
}

export function ConversationPanel({ conversationId, otherName, otherAvatar, pendingContext, pendingContextImage }: Props) {
  const session = useSession()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isFirstLoad = useRef(true)
  const isAtBottom = useRef(true)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [isSending, setIsSending] = useState(false)

  const { data: history } = trpc.message.messages.useQuery(
    { conversation_id: conversationId },
    { enabled: !!conversationId }
  )

  const utils = trpc.useUtils()
  const markRead = trpc.message.markRead.useMutation()
  const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation()
  const sendMutation = trpc.message.send.useMutation()

  useEffect(() => {
    if (history) {
      setMessages(history)
    }
  }, [history])

  // Runs before browser paints — jumps to bottom instantly on first load, no scroll animation
  useLayoutEffect(() => {
    if (messages.length > 0 && isFirstLoad.current) {
      isFirstLoad.current = false
      const container = scrollContainerRef.current
      if (container) container.scrollTop = container.scrollHeight
    }
  }, [messages])

  // Track whether user is near the bottom (within 80px threshold)
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      isAtBottom.current = scrollHeight - scrollTop - clientHeight < 80
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [])

  // ResizeObserver on inner content — if content grows (e.g. image loads) and user is at bottom, stay at bottom
  useEffect(() => {
    const content = contentRef.current
    const container = scrollContainerRef.current
    if (!content || !container) return
    const observer = new ResizeObserver(() => {
      if (isAtBottom.current) container.scrollTop = container.scrollHeight
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!conversationId) return

    markRead.mutate({ conversation_id: conversationId })

    const supabase = createSupabaseBrowserClient()
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          scrollToBottom()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  const handleSend = useCallback(async (payload: SendPayload) => {
    const tempId = `optimistic-${Date.now()}`
    const now = new Date().toISOString()

    const optimisticMsg: DisplayMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: session?.user?.id ?? '',
      body: payload.body ?? null,
      image_url: null,
      context_type: payload.contextType ?? null,
      context_id: payload.contextId ?? null,
      context_label: payload.contextLabel ?? null,
      context_image_url: payload.contextImage ?? null,
      created_at: now,
      isOptimistic: true,
      localImageUrl: payload.localPreviewUrl,
      uploadProgress: payload.file ? 0 : undefined,
    }

    setMessages(prev => [...prev, optimisticMsg])
    scrollToBottom()
    setIsSending(true)

    try {
      let imageUrl: string | undefined

      if (payload.file) {
        const { presignedUrl, publicUrl } = await getPresignedUrl.mutateAsync({
          purpose: 'message',
          contentType: payload.file.type,
          fileSize: payload.file.size,
        })

        await uploadWithProgress(presignedUrl, payload.file, payload.file.type, (p) => {
          setMessages(prev =>
            prev.map(m => m.id === tempId ? { ...m, uploadProgress: p } : m)
          )
        })

        imageUrl = publicUrl
      }

      await sendMutation.mutateAsync({
        conversation_id: conversationId,
        body: payload.body || undefined,
        image_url: imageUrl,
        context_type: payload.contextType,
        context_id: payload.contextId,
        context_label: payload.contextLabel,
        context_image_url: payload.contextImage,
      })

      // Remove the optimistic message — Realtime will add the real one
      setMessages(prev => prev.filter(m => m.id !== tempId))
      if (payload.localPreviewUrl) URL.revokeObjectURL(payload.localPreviewUrl)
      markRead.mutate({ conversation_id: conversationId })
      utils.message.list.invalidate()
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      toast.error(err?.message ?? '傳送失敗')
    } finally {
      setIsSending(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, session?.user?.id])

  return (
    <section style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#fafaf8', overflow: 'hidden' }}>
      {/* Chat Header */}
      <div style={{
        height: 68, borderBottom: '1px solid #ececec', background: '#fff',
        padding: '0 20px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
      }}>
        <Avatar style={{ width: 40, height: 40, flexShrink: 0 }}>
          <AvatarImage src={otherAvatar ?? undefined} />
          <AvatarFallback style={{ background: 'linear-gradient(135deg, #2d3a5e, #0f1a36)', color: '#fff', fontFamily: 'Rubik, sans-serif', fontWeight: 700 }}>
            {otherName?.[0] ?? '?'}
          </AvatarFallback>
        </Avatar>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {otherName ?? '對話'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconBtn title="詳情"><Info style={{ width: 15, height: 15 }} /></IconBtn>
          <IconBtn title="更多"><MoreHorizontal style={{ width: 15, height: 15 }} /></IconBtn>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <div ref={contentRef} style={{ padding: '12px 0' }}>
          {messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.sender_id === session?.user?.id}
              prevMessage={messages[i - 1] ?? null}
              localImageUrl={msg.localImageUrl}
              uploadProgress={msg.uploadProgress}
            />
          ))}
          <div ref={scrollRef} />
        </div>
      </div>

      <MessageInput
        onSend={handleSend}
        isSending={isSending}
        contextType={pendingContext?.contextType}
        contextId={pendingContext?.contextId}
        contextLabel={pendingContext?.contextLabel}
        contextImage={pendingContextImage}
      />
    </section>
  )
}

function IconBtn({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <button title={title} style={{
      width: 34, height: 34, borderRadius: 8, border: '1px solid #e6e2dc', background: '#fff',
      cursor: 'pointer', color: '#444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {children}
    </button>
  )
}
