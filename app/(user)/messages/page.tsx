'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConversationList } from '@/components/message/conversation-list'
import { ConversationPanel } from '@/components/message/conversation-panel'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'

export default function MessagesPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const utils = trpc.useUtils()

  const sellerId = searchParams.get('seller_id')

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [selectedOther, setSelectedOther] = useState<{ name: string | null; avatar: string | null; lastSeenAt: string | null } | null>(null)
  const [pendingContext, setPendingContext] = useState<{
    contextType?: 'listing' | 'connection'
    contextId?: string
    contextLabel?: string
    contextImage?: string
  }>({})
  const [mobileView, setMobileView] = useState<'list' | 'panel'>('list')
  const processedRef = useRef(false)

  // Lock page scroll — body uses min-height so it can overflow
  useEffect(() => {
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
    }
  }, [])

  const getOrCreate = trpc.message.getOrCreate.useMutation({
    onSuccess: (conv) => {
      setSelectedConversationId(conv.id)
      setMobileView('panel')
      utils.message.list.invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  useEffect(() => {
    if (sellerId && !processedRef.current) {
      processedRef.current = true
      // Read from window.location directly — useSearchParams can be stale during effect
      const params = new URLSearchParams(window.location.search)
      const cType = params.get('context_type') as 'listing' | 'connection' | null
      const cId = params.get('context_id')
      const cLabel = params.get('context_label')
      const cImage = params.get('context_image')
      const sName = params.get('seller_name')
      const sAvatar = params.get('seller_avatar')

      if (sName || sAvatar) {
        setSelectedOther({ name: sName || null, avatar: sAvatar || null, lastSeenAt: null })
      }
      if (cType && cId) {
        setPendingContext({
          contextType: cType,
          contextId: cId,
          contextLabel: cLabel ?? undefined,
          contextImage: cImage ?? undefined,
        })
      }
      getOrCreate.mutate({ seller_id: sellerId })
      router.replace('/messages')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId])

  const handleSelectConversation = (id: string, otherName: string | null, otherAvatar: string | null, otherLastSeenAt: string | null) => {
    setSelectedConversationId(id)
    setSelectedOther({ name: otherName, avatar: otherAvatar, lastSeenAt: otherLastSeenAt })
    setPendingContext({})
    setMobileView('panel')
  }

  return (
    <div style={{ height: 'calc(100vh - 4rem)', display: 'flex', overflow: 'hidden', padding: '16px 24px 24px', background: '#FAFAFD' }}>
      <div style={{
        flex: 1, display: 'flex', minHeight: 0, background: '#fff',
        border: '1px solid #ececec', borderRadius: 18, overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
      }}>
        {/* Left: Conversation List */}
        <div className={`flex-col ${mobileView === 'panel' ? 'hidden' : 'flex'} md:flex`} style={{ flexShrink: 0, height: '100%' }}>
          <ConversationList
            selectedId={selectedConversationId}
            onSelect={handleSelectConversation}
          />
        </div>

        {/* Right: Conversation Panel */}
        <div
          className={`flex flex-1 flex-col min-w-0 ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}
        >
          {/* Mobile back button */}
          <div className="flex items-center border-b px-3 py-2 md:hidden" style={{ borderColor: '#ececec' }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileView('list')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>

          {selectedConversationId ? (
            <ConversationPanel
              key={selectedConversationId}
              conversationId={selectedConversationId}
              otherName={selectedOther?.name ?? null}
              otherAvatar={selectedOther?.avatar ?? null}
              otherLastSeenAt={selectedOther?.lastSeenAt ?? null}
              pendingContext={pendingContext}
              pendingContextImage={pendingContext.contextImage}
            />
          ) : (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8, color: '#9a9a9a', fontSize: 14,
            }} className="hidden md:flex">
              <p>選擇一個對話開始聊天</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
