import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight } from 'lucide-react'

type Props = {
  contextType: 'listing' | 'connection'
  contextId: string
  contextLabel: string
  imageUrl?: string
}

const CONTEXT_META = {
  connection: {
    label: '連線代購',
    chipBg: '#EFF6FF',
    chipColor: '#2563EB',
    gradient: 'linear-gradient(135deg, #1e3a5f 0%, #1a4a8a 100%)',
  },
  listing: {
    label: '代購商品',
    chipBg: '#FFF7ED',
    chipColor: '#C2410C',
    gradient: 'linear-gradient(135deg, #7c2d12 0%, #b45309 100%)',
  },
} as const

export function ContextCard({ contextType, contextId, contextLabel, imageUrl }: Props) {
  const href = contextType === 'listing' ? `/listings/${contextId}` : `/connections/${contextId}`
  const { label, chipBg, chipColor, gradient } = CONTEXT_META[contextType]

  return (
    <Link
      href={href}
      style={{
        display: 'flex', alignItems: 'stretch',
        borderRadius: 14, border: '1px solid #e8e3dc',
        background: '#fff', overflow: 'hidden',
        textDecoration: 'none',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        transition: 'box-shadow .15s, border-color .15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.10)'
        e.currentTarget.style.borderColor = '#d0cbc2'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'
        e.currentTarget.style.borderColor = '#e8e3dc'
      }}
    >
      {/* Left: photo or gradient */}
      <div style={{ width: 84, height: 84, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={contextLabel}
            fill
            style={{ objectFit: 'cover' }}
            sizes="84px"
          />
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            background: gradient,
          }} />
        )}
        {/* subtle dark overlay for text legibility */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.08), transparent)' }} />
      </div>

      {/* Right: content */}
      <div style={{ flex: 1, minWidth: 0, padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start',
          height: 20, padding: '0 8px', borderRadius: 999,
          background: chipBg, fontSize: 11, fontWeight: 600,
          color: chipColor, letterSpacing: '0.01em',
        }}>
          {label}
        </div>

        <p style={{
          fontSize: 13, fontWeight: 600, color: '#111',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          margin: 0, lineHeight: 1.4,
        }}>
          {contextLabel}
        </p>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          fontSize: 11, fontWeight: 500, color: '#888',
        }}>
          查看詳情 <ArrowUpRight style={{ width: 11, height: 11 }} />
        </div>
      </div>
    </Link>
  )
}
