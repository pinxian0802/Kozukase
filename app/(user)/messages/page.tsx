'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef, useMemo } from 'react'
import { ConversationList } from '@/components/message/conversation-list'
import { ConversationPanel } from '@/components/message/conversation-panel'
import { trpc } from '@/lib/trpc/client'
import { useSession } from '@/lib/context/session-context'
import { toast } from 'sonner'

type ListedProfile = {
  id: string
  display_name: string | null
  avatar_url: string | null
  last_seen_at: string | null
}

type ListedSellerProfile = ListedProfile & {
  seller_identity: { name: string | null; avatar_url: string | null } | null
}

export default function MessagesPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const utils = trpc.useUtils()
  const session = useSession()

  const sellerId = searchParams.get('seller_id')

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [selectedOther, setSelectedOther] = useState<{ name: string | null; avatar: string | null; lastSeenAt: string | null; sellerId: string | null } | null>(null)
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

  // 對話清單查詢:左邊那欄已經會跑同一支 query,trpc 會自動共用快取,
  // 這裡只是為了在 header 上拿到對方的名字 / 頭貼 / 上線時間,
  // 不會額外打 API。
  const { data: conversations } = trpc.message.list.useQuery(undefined, { staleTime: 0 })

  // 從對話清單反查目前選中的對話對方是誰,這樣即使網址沒帶 seller_name /
  // seller_avatar(例如從賣家頁的私訊按鈕進來),清單載入完成後 header
  // 就會自動補上。對方之後改名換頭貼也會跟著更新。
  const otherFromList = useMemo(() => {
    if (!selectedConversationId || !conversations || !session?.user?.id) return null
    const conv = conversations.find(c => c.id === selectedConversationId)
    if (!conv) return null
    const isBuyer = conv.buyer_id === session.user.id
    if (isBuyer) {
      // 對方是賣家:優先用賣家身份的名稱 / 頭貼
      const sp = conv.seller_profile as unknown as ListedSellerProfile | null
      if (!sp) return null
      return {
        name: sp.seller_identity?.name ?? sp.display_name ?? null,
        avatar: sp.seller_identity?.avatar_url ?? sp.avatar_url ?? null,
        lastSeenAt: sp.last_seen_at ?? null,
        sellerId: conv.seller_id,
      }
    } else {
      // 對方是買家:用一般個人檔案,沒有賣家頁可跳
      const bp = conv.buyer_profile as unknown as ListedProfile | null
      if (!bp) return null
      return {
        name: bp.display_name ?? null,
        avatar: bp.avatar_url ?? null,
        lastSeenAt: bp.last_seen_at ?? null,
        sellerId: null,
      }
    }
  }, [conversations, selectedConversationId, session?.user?.id])

  // 優先用清單裡的最新資料,清單還沒回來時退回到進場時帶的 hint,
  // 避免從外部連結進來時 header 閃一下空白。
  const effectiveOther = otherFromList ?? selectedOther
  const otherPageUrl = effectiveOther?.sellerId ? `/sellers/${effectiveOther.sellerId}` : null

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
        setSelectedOther({ name: sName || null, avatar: sAvatar || null, lastSeenAt: null, sellerId: sellerId })
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

  const handleSelectConversation = (id: string, otherName: string | null, otherAvatar: string | null, otherLastSeenAt: string | null, otherSellerId: string | null) => {
    setSelectedConversationId(id)
    setSelectedOther({ name: otherName, avatar: otherAvatar, lastSeenAt: otherLastSeenAt, sellerId: otherSellerId })
    setPendingContext({})
    setMobileView('panel')
  }

  return (
    <div className="md:px-6 md:pt-4 md:pb-6" style={{ height: 'calc(100dvh - 4rem)', display: 'flex', overflow: 'hidden', background: 'var(--surface-page)' }}>
      <div
        className="rounded-none border-0 shadow-none md:rounded-[18px] md:border md:shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
        style={{
          flex: 1, display: 'flex', minHeight: 0, background: 'var(--surface-card)',
          borderColor: 'var(--border-soft)', overflow: 'hidden',
        }}
      >
        {/* Left: Conversation List */}
        <div className={`w-full md:w-auto flex-col ${mobileView === 'panel' ? 'hidden' : 'flex'} md:flex`} style={{ flexShrink: 0, height: '100%' }}>
          <ConversationList
            selectedId={selectedConversationId}
            onSelect={handleSelectConversation}
          />
        </div>

        {/* Right: Conversation Panel */}
        <div
          className={`flex flex-1 flex-col min-w-0 ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}
        >
          {selectedConversationId ? (
            <ConversationPanel
              key={selectedConversationId}
              conversationId={selectedConversationId}
              otherName={effectiveOther?.name ?? null}
              otherAvatar={effectiveOther?.avatar ?? null}
              otherLastSeenAt={effectiveOther?.lastSeenAt ?? null}
              otherPageUrl={otherPageUrl}
              onBack={() => setMobileView('list')}
              pendingContext={pendingContext}
              pendingContextImage={pendingContext.contextImage}
            />
          ) : (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8, color: 'var(--text-faint)', fontSize: 14,
            }} className="hidden md:flex">
              <p>選擇一個對話開始聊天</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
