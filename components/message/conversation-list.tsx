'use client'

import { useState, useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { MessageSquare, Search } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { trpc } from '@/lib/trpc/client'
import { useSession } from '@/lib/context/session-context'
import { cn } from '@/lib/utils'

type Props = {
  selectedId: string | null
  onSelect: (id: string, otherName: string | null, otherAvatar: string | null, otherLastSeenAt: string | null, otherSellerId: string | null) => void
}

type OtherProfile = {
  id: string
  display_name: string | null
  avatar_url: string | null
  last_seen_at: string | null
}

type SellerProfile = OtherProfile & {
  seller_identity: { name: string | null; avatar_url: string | null } | null
}

type TabKey = 'all' | 'unread'

export function ConversationList({ selectedId, onSelect }: Props) {
  const session = useSession()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<TabKey>('all')

  const { data: conversations, isLoading } = trpc.message.list.useQuery(undefined, { staleTime: 0 })

  // 即時刷新由 Header 內的 <UserChannelListener /> 統一處理:
  // 收到 user:<myId> 頻道的 messages_changed 廣播後,會 invalidate
  // message.list 與 message.unreadCount,本元件會自動 refetch。

  const processedConvs = useMemo(() => {
    if (!conversations) return []
    return conversations.map(conv => {
      const isBuyer = conv.buyer_id === session?.user?.id
      const unreadCount = (conv as any).unread_count as number ?? 0
      let other: OtherProfile | null
      if (isBuyer) {
        // 對方是賣家:優先用賣家身份的名稱 / 頭貼
        const sp = conv.seller_profile as unknown as SellerProfile | null
        other = sp ? {
          id: sp.id,
          display_name: sp.seller_identity?.name ?? sp.display_name,
          avatar_url: sp.seller_identity?.avatar_url ?? sp.avatar_url,
          last_seen_at: sp.last_seen_at,
        } : null
      } else {
        // 對方是買家:用一般個人檔案
        other = conv.buyer_profile as unknown as OtherProfile | null
      }
      return { ...conv, other, unreadCount }
    })
  }, [conversations, session?.user?.id])

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: processedConvs.length },
    { key: 'unread', label: '未讀', count: processedConvs.filter(c => c.unreadCount > 0).length },
  ]

  const filtered = useMemo(() => {
    return processedConvs.filter(c => {
      if (tab === 'unread' && c.unreadCount === 0) return false
      if (query) {
        const q = query.toLowerCase()
        const name = c.other?.display_name?.toLowerCase() ?? ''
        const preview = c.last_message_preview?.toLowerCase() ?? ''
        if (!name.includes(q) && !preview.includes(q)) return false
      }
      return true
    })
  }, [processedConvs, tab, query])

  return (
    <aside className="flex flex-col w-full md:w-80 md:shrink-0" style={{ borderRight: '1px solid var(--border-soft)', background: 'var(--surface-page)', overflow: 'hidden', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid var(--border-soft)' }}>
        <h1 style={{ fontFamily: 'Rubik, sans-serif', fontWeight: 700, fontSize: 22, letterSpacing: '-0.01em', color: 'var(--text-strong)', marginBottom: 12 }}>
          訊息
        </h1>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-faint)', pointerEvents: 'none' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜尋賣家或訊息…"
            style={{
              width: '100%', height: 36, border: '1px solid var(--border-soft)', borderRadius: 8,
              padding: '0 12px 0 32px', fontSize: 13, outline: 'none', background: 'var(--surface-card)', color: 'var(--text-strong)',
            }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 12px', borderBottom: '1px solid var(--border-soft)', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px',
            borderRadius: 999, fontSize: 12, fontWeight: 500,
            background: tab === t.key ? 'var(--text-strong)' : 'transparent',
            color: tab === t.key ? 'var(--surface-card)' : 'var(--text-muted)',
            border: tab === t.key ? '1px solid var(--text-strong)' : '1px solid var(--border-soft)',
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s',
          }}>
            {t.label}
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: tab === t.key ? 'rgba(255,255,255,0.7)' : 'var(--text-faint)',
              fontVariantNumeric: 'tabular-nums',
            }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {isLoading ? (
          <div className="flex flex-col gap-2 p-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
            {processedConvs.length === 0 ? (
              <div className="flex flex-col items-center gap-2">
                <MessageSquare style={{ width: 32, height: 32, color: 'var(--border-strong)' }} />
                <p>還沒有任何對話</p>
              </div>
            ) : '找不到符合的對話'}
          </div>
        ) : (
          filtered.map(conv => (
            <ConvRow
              key={conv.id}
              name={conv.other?.display_name ?? '用戶'}
              avatarUrl={conv.other?.avatar_url ?? null}
              lastAt={conv.last_message_at}
              preview={conv.last_message_preview ?? null}
              unreadCount={conv.unreadCount}
              isActive={selectedId === conv.id}
              onClick={() => {
                const isConvBuyer = conv.buyer_id === session?.user?.id
                onSelect(conv.id, conv.other?.display_name ?? null, conv.other?.avatar_url ?? null, conv.other?.last_seen_at ?? null, isConvBuyer ? conv.seller_id : null)
              }}
            />
          ))
        )}
      </div>
    </aside>
  )
}

function ConvRow({
  name, avatarUrl, lastAt, preview, unreadCount, isActive, onClick,
}: {
  name: string
  avatarUrl: string | null
  lastAt: string | null
  preview: string | null
  unreadCount: number
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '14px 16px',
        background: isActive ? 'var(--surface-muted)' : 'transparent',
        border: 'none', borderBottom: '1px solid var(--border-soft)',
        cursor: 'pointer', textAlign: 'left', transition: 'background .12s',
      }}
      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-muted)' }}
      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
    >
      <Avatar style={{ width: 44, height: 44, flexShrink: 0 }}>
        <AvatarImage src={avatarUrl ?? undefined} />
        <AvatarFallback style={{ background: 'linear-gradient(135deg, #2d3a5e, #0f1a36)', color: 'var(--surface-card)', fontFamily: 'Rubik, sans-serif', fontWeight: 700 }}>
          {name[0]}
        </AvatarFallback>
      </Avatar>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 14, fontWeight: unreadCount > 0 ? 700 : 600, color: 'var(--text-strong)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
          {lastAt && (
            <span style={{ fontSize: 11, color: unreadCount > 0 ? 'var(--text-strong)' : 'var(--text-faint)', fontWeight: unreadCount > 0 ? 600 : 400, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              {formatDistanceToNow(new Date(lastAt), { addSuffix: true, locale: zhTW })}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            flex: 1, fontSize: 13, color: unreadCount > 0 ? 'var(--text-strong)' : 'var(--text-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontWeight: unreadCount > 0 ? 500 : 400,
          }}>
            {preview ?? '開始對話'}
          </span>
          {unreadCount > 0 && (
            <span style={{
              minWidth: 18, height: 18, borderRadius: 999,
              background: 'var(--text-strong)', color: 'var(--surface-card)',
              fontSize: 10, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 5px', flexShrink: 0,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
