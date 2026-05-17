'use client'

import Link from 'next/link'
import Image from 'next/image'
import { MapPin, ChevronRight } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'
import { formatDate, formatPrice } from '@/lib/utils/format'

type Props = {
  contextType: 'listing' | 'connection'
  contextId: string
  contextLabel: string
  imageUrl?: string
}

// The deeply-nested tRPC selects degrade Supabase's inferred element types to
// `any`; this is the concrete shape of the *_images rows we read here.
type ImageRow = {
  url: string | null
  thumbnail_url: string | null
  sort_order: number
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

function ViewButton({ href }: { href: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        height: 34, padding: '0 14px', borderRadius: 8, gap: 5,
        border: '1px solid #e0dbd3', background: '#f8f6f3',
        fontSize: 13, fontWeight: 500, color: '#444',
        textDecoration: 'none', flexShrink: 0,
        transition: 'background .12s, border-color .12s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = '#eeebe4'
        e.currentTarget.style.borderColor = '#ccc8c0'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = '#f8f6f3'
        e.currentTarget.style.borderColor = '#e0dbd3'
      }}
    >
      查看 <ChevronRight style={{ width: 13, height: 13 }} />
    </Link>
  )
}

function ConnectionContextCard({ contextId, contextLabel, imageUrl }: { contextId: string; contextLabel: string; imageUrl?: string }) {
  const href = `/connections/${contextId}`
  const { gradient } = CONTEXT_META.connection
  const { data } = trpc.connection.getById.useQuery({ id: contextId }, { staleTime: 5 * 60 * 1000 })

  const firstImage = data?.connection_images?.sort((a: ImageRow, b: ImageRow) => a.sort_order - b.sort_order)[0]
  const displayImage = imageUrl ?? firstImage?.thumbnail_url ?? firstImage?.url ?? null

  return (
    <div style={{
      display: 'flex', height: 130,
      borderRadius: 14, border: '1px solid #e8e3dc',
      background: '#fff', overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      {/* Left: square image = 130x130 */}
      <div style={{ width: 130, height: 130, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        {displayImage ? (
          <Image src={displayImage} alt={contextLabel} fill style={{ objectFit: 'cover' }} sizes="130px" />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: gradient }} />
        )}
      </div>

      {/* Middle: content */}
      <div className="flex flex-1 flex-col justify-center p-4 min-w-0 min-h-0">
        <div className="flex flex-col gap-0">
          {data && (
            <span className="text-xs text-muted-foreground">
              {formatDate(data.start_date)} ~ {formatDate(data.end_date)}
            </span>
          )}
          <h3 className="text-base font-bold leading-snug line-clamp-1" style={{ fontFamily: 'var(--font-sans-tc), "微软雅黑", "Microsoft YaHei", sans-serif' }}>
            {contextLabel}
          </h3>
          {data && (data.region?.name || (data.locations && data.locations.length > 0)) && (
            <div className="flex flex-wrap items-center gap-1 mt-1.5">
              {data.region?.name && (
                <span className="inline-flex items-center gap-0.5 text-xs font-medium text-primary mr-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {data.region.name}
                </span>
              )}
              {data.locations?.slice(0, 2).map((loc: string) => (
                <span key={loc} className="rounded-md bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground cursor-default">
                  {loc}
                </span>
              ))}
              {data.locations && data.locations.length > 2 && (
                <span className="text-xs text-muted-foreground">+{data.locations.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: 查看 button vertically centered */}
      <div style={{ display: 'flex', alignItems: 'center', paddingRight: 14 }}>
        <ViewButton href={href} />
      </div>
    </div>
  )
}

function ListingContextCard({ contextId, contextLabel, imageUrl }: { contextId: string; contextLabel: string; imageUrl?: string }) {
  const href = `/listings/${contextId}`
  const { gradient } = CONTEXT_META.listing
  const { data } = trpc.listing.getById.useQuery({ id: contextId }, { staleTime: 5 * 60 * 1000 })

  const firstImage = data?.listing_images?.sort((a: ImageRow, b: ImageRow) => a.sort_order - b.sort_order)[0]
  const displayImage = imageUrl ?? firstImage?.thumbnail_url ?? firstImage?.url ?? null
  const brandLabel = typeof data?.product?.brand === 'string' ? data.product.brand : (data?.product?.brand as any)?.name ?? null

  return (
    <div style={{
      display: 'flex', height: 130,
      borderRadius: 14, border: '1px solid #e8e3dc',
      background: '#fff', overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ width: 130, height: 130, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        {displayImage ? (
          <Image src={displayImage} alt={contextLabel} fill style={{ objectFit: 'cover' }} sizes="130px" />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: gradient }} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="grid gap-0.5">
          {brandLabel && (
            <p className="truncate text-[11px] font-medium leading-none text-muted-foreground">{brandLabel}</p>
          )}
          <h3 className="line-clamp-2 text-base font-bold leading-snug">{contextLabel}</h3>
          {data?.title && data.product?.name && data.title !== data.product.name && (
            <p className="line-clamp-1 text-[12.5px] font-medium leading-normal text-muted-foreground">{data.product.name}</p>
          )}
        </div>
        {data && (
          <div className="pt-2">
            <span className="text-sm font-semibold text-primary">
              {formatPrice(data.price, data.is_price_on_request)}
            </span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', paddingRight: 14 }}>
        <ViewButton href={href} />
      </div>
    </div>
  )
}

export function ContextCard({ contextType, contextId, contextLabel, imageUrl }: Props) {
  if (contextType === 'connection') {
    return <ConnectionContextCard contextId={contextId} contextLabel={contextLabel} imageUrl={imageUrl} />
  }
  return <ListingContextCard contextId={contextId} contextLabel={contextLabel} imageUrl={imageUrl} />
}
