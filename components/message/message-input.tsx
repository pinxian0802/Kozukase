'use client'

import { useState, useRef } from 'react'
import { ImagePlus, Send, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { normalizeImageFile } from '@/lib/utils/heic'
import { ContextCard } from './context-card'

export type SendPayload = {
  body?: string
  file?: File
  localPreviewUrl?: string
  contextType?: 'listing' | 'connection'
  contextId?: string
  contextLabel?: string
  contextImage?: string
}

type Props = {
  onSend: (payload: SendPayload) => void
  isSending?: boolean
  contextType?: 'listing' | 'connection'
  contextId?: string
  contextLabel?: string
  contextImage?: string
}

export function MessageInput({
  onSend,
  isSending,
  contextType,
  contextId,
  contextLabel,
  contextImage,
}: Props) {
  const [body, setBody] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [contextSent, setContextSent] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0]
    if (!raw) return
    e.target.value = ''
    setProcessing(true)
    try {
      const normalized = await normalizeImageFile(raw)
      const { default: imageCompression } = await import('browser-image-compression')
      const compressed = await imageCompression(normalized, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1280,
        fileType: 'image/webp',
        useWebWorker: true,
      })
      const webpFile = new File(
        [compressed],
        normalized.name.replace(/\.[^.]+$/, '.webp'),
        { type: 'image/webp' },
      )
      const url = URL.createObjectURL(webpFile)
      setFile(webpFile)
      setLocalPreviewUrl(url)
    } catch {
      toast.error('無法載入圖片')
    } finally {
      setProcessing(false)
    }
  }

  const clearImage = () => {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl)
    setFile(null)
    setLocalPreviewUrl(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSend = () => {
    if (!body.trim() && !file) return

    const ctx = !contextSent && contextType && contextId
    onSend({
      body: body.trim() || undefined,
      file: file ?? undefined,
      localPreviewUrl: localPreviewUrl ?? undefined,
      contextType: ctx ? contextType : undefined,
      contextId: ctx ? contextId : undefined,
      contextLabel: ctx ? contextLabel : undefined,
      contextImage: ctx ? contextImage : undefined,
    })

    setBody('')
    setFile(null)
    setLocalPreviewUrl(null)
    // Do NOT revoke here — the blob URL is still needed by the optimistic message bubble.
    // ConversationPanel revokes it after the optimistic message is removed.
    if (ctx) setContextSent(true)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = (body.trim().length > 0 || !!file) && !isSending && !processing

  return (
    <div className="px-3 pt-2.5 pb-3 md:px-5 md:pt-3 md:pb-4" style={{ borderTop: '1px solid var(--border-soft)', background: 'var(--surface-card)', flexShrink: 0 }}>
      {/* Context card */}
      {!contextSent && contextType && contextId && (
        <div style={{ marginBottom: 10 }}>
          <ContextCard
            contextType={contextType}
            contextId={contextId}
            contextLabel={contextLabel ?? ''}
            imageUrl={contextImage}
          />
        </div>
      )}

      {/* Local image preview */}
      {localPreviewUrl && (
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={localPreviewUrl}
            alt="預覽"
            style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border-soft)', display: 'block' }}
          />
          <button
            onClick={clearImage}
            style={{
              position: 'absolute', top: -6, right: -6,
              width: 20, height: 20, borderRadius: '50%',
              background: 'var(--text-strong)', color: 'var(--surface-card)', border: 'none', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X style={{ width: 10, height: 10 }} />
          </button>
        </div>
      )}

      {/* Composer */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 6,
        border: '1px solid var(--border-soft)', borderRadius: 14, background: 'var(--surface-page)', padding: '6px 6px 6px 10px',
      }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.heic,.heif"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          type="button"
          title="圖片"
          disabled={processing}
          onClick={() => fileRef.current?.click()}
          style={{
            width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent',
            cursor: processing ? 'not-allowed' : 'pointer', color: 'var(--text-muted)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          {processing
            ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
            : <ImagePlus style={{ width: 16, height: 16 }} />
          }
        </button>

        <textarea
          ref={textareaRef}
          value={body}
          rows={1}
          onChange={e => {
            setBody(e.target.value)
            const el = e.target
            el.style.height = 'auto'
            el.style.height = Math.min(140, el.scrollHeight) + 'px'
          }}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1, resize: 'none', border: 'none', outline: 'none',
            background: 'transparent', fontSize: 14, lineHeight: 1.5,
            color: 'var(--text-strong)', padding: '8px 8px', maxHeight: 140, minHeight: 36,
            fontFamily: 'inherit',
          }}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          style={{
            width: 36, height: 36, borderRadius: 10, border: 'none',
            cursor: canSend ? 'pointer' : 'not-allowed',
            background: canSend ? 'var(--text-strong)' : 'var(--neutral-300)',
            color: 'var(--surface-card)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'background .15s',
          }}
        >
          <Send style={{ width: 15, height: 15 }} />
        </button>
      </div>
    </div>
  )
}
