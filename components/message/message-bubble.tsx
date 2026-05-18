import { format, isToday, isYesterday } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { ContextCard } from './context-card'
import type { Message } from '@/server/db/types'

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  if (isToday(date)) return '今天'
  if (isYesterday(date)) return '昨天'
  return format(date, 'M月d日', { locale: zhTW })
}

export function DateSeparator({ date }: { date: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'center',
      padding: '12px 0 4px',
    }}>
      <span style={{
        fontSize: 11, fontWeight: 500, color: '#aaa',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {formatDateLabel(date)}
      </span>
    </div>
  )
}

type Props = {
  message: Message
  isOwn: boolean
  prevMessage: Message | null
  localImageUrl?: string
  uploadProgress?: number
}

export function MessageBubble({ message, isOwn, prevMessage, localImageUrl, uploadProgress }: Props) {
  const grouped = prevMessage && prevMessage.sender_id === message.sender_id
  const showTime = !prevMessage || prevMessage.sender_id !== message.sender_id ||
    Math.abs(new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime()) > 5 * 60 * 1000

  const ownCorners = { borderRadius: '18px 18px 6px 18px' }
  const otherCorners = { borderRadius: '18px 18px 18px 6px' }

  const displayImageUrl = localImageUrl || message.image_url
  const isUploading = uploadProgress !== undefined && uploadProgress < 100

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isOwn ? 'flex-end' : 'flex-start',
      padding: `${message.context_type ? 12 : grouped ? 2 : 8}px 24px`,
      gap: 4,
    }}>
      {message.context_type && message.context_id && message.context_label && (
        <div style={{ width: '100%', maxWidth: 460, marginBottom: 6 }}>
          <ContextCard
            contextType={message.context_type}
            contextId={message.context_id}
            contextLabel={message.context_label}
            imageUrl={message.context_image_url ?? undefined}
          />
        </div>
      )}

      <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', gap: 4 }}>
        {displayImageUrl && (
          <div style={{
            overflow: 'hidden', border: '1px solid #ececec',
            background: '#f5f5f5', maxWidth: 280, position: 'relative',
            ...(isOwn ? ownCorners : otherCorners),
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayImageUrl}
              alt="圖片"
              style={{
                width: '100%', maxWidth: 280, display: 'block',
                opacity: isUploading ? 0.7 : 1,
                transition: 'opacity .2s',
              }}
            />

            {/* Upload progress bar */}
            {isUploading && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
                background: 'rgba(0,0,0,0.15)',
              }}>
                <div style={{
                  height: '100%',
                  width: `${uploadProgress}%`,
                  background: '#fff',
                  transition: 'width .1s ease',
                  borderRadius: '0 2px 2px 0',
                }} />
              </div>
            )}
          </div>
        )}

        {message.body && (
          <div style={{
            padding: '10px 14px',
            fontSize: 14,
            lineHeight: 1.55,
            background: isOwn ? '#111' : '#fff',
            color: isOwn ? '#fff' : '#111',
            border: isOwn ? 'none' : '1px solid #ececec',
            opacity: uploadProgress !== undefined && uploadProgress < 100 ? 0.6 : 1,
            ...(isOwn ? ownCorners : otherCorners),
          }}>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.body}</p>
          </div>
        )}

        {showTime && (
          <span style={{ fontSize: 10, color: '#aaa', fontVariantNumeric: 'tabular-nums', padding: '0 4px' }}>
            {format(new Date(message.created_at), 'HH:mm', { locale: zhTW })}
          </span>
        )}
      </div>
    </div>
  )
}
