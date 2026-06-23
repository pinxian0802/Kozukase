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

// 空圖片時的 fallback 漸層；chipBg/chipColor 經盤點未使用,已移除。
// TODO: gradient 端點目前用深色狀態色（info/warning 變體）,Phase 4 新增 status dark 色階後再收進 token。
const CONTEXT_META = {
  connection: {
    label: '連線代購',
    gradient: 'linear-gradient(135deg, #1e3a5f 0%, #1a4a8a 100%)',
  },
  listing: {
    label: '代購商品',
    gradient: 'linear-gradient(135deg, #7c2d12 0%, #b45309 100%)',
  },
} as const

// ===== 桌機版（原樣,勿動）：右側「查看」按鈕,130px =====
function ViewButton({ href }: { href: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        height: 34, padding: '0 14px', borderRadius: 8, gap: 5,
        border: '1px solid var(--border-soft)', background: 'var(--surface-muted)',
        fontSize: 13, fontWeight: 500, color: 'var(--text-muted)',
        textDecoration: 'none', flexShrink: 0,
        transition: 'background .12s, border-color .12s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--neutral-200)'
        e.currentTarget.style.borderColor = 'var(--border-strong)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--surface-muted)'
        e.currentTarget.style.borderColor = 'var(--border-soft)'
      }}
    >
      查看 <ChevronRight style={{ width: 13, height: 13 }} />
    </Link>
  )
}

function DesktopImage({ src, alt, gradient }: { src: string | null; alt: string; gradient: string }) {
  return (
    <div style={{ width: 130, height: 130, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
      {src ? (
        <Image src={src} alt={alt} fill style={{ objectFit: 'cover' }} sizes="130px" />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: gradient }} />
      )}
    </div>
  )
}

// ===== 手機版（新設計）：整張可點 + 右側淡箭頭,84px =====
function MobileShell({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex md:hidden h-[84px]"
      style={{
        alignItems: 'stretch', textDecoration: 'none',
        borderRadius: 14, border: '1px solid var(--border-soft)',
        background: 'var(--surface-card)', overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      {children}
      <div style={{ display: 'flex', alignItems: 'center', paddingRight: 8, color: 'var(--text-faint)', flexShrink: 0 }}>
        <ChevronRight style={{ width: 18, height: 18 }} />
      </div>
    </Link>
  )
}

function MobileImage({ src, alt, gradient }: { src: string | null; alt: string; gradient: string }) {
  return (
    <div className="h-[84px] w-[84px] shrink-0 relative overflow-hidden">
      {src ? (
        <Image src={src} alt={alt} fill style={{ objectFit: 'cover' }} sizes="84px" />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: gradient }} />
      )}
    </div>
  )
}

function ConnectionContextCard({ contextId, contextLabel, imageUrl }: { contextId: string; contextLabel: string; imageUrl?: string }) {
  const href = `/connections/${contextId}`
  const { gradient } = CONTEXT_META.connection
  const { data } = trpc.connection.getById.useQuery({ id: contextId }, { staleTime: 5 * 60 * 1000 })

  const firstImage = data?.connection_images?.sort((a: ImageRow, b: ImageRow) => a.sort_order - b.sort_order)[0]
  const displayImage = imageUrl ?? firstImage?.thumbnail_url ?? firstImage?.url ?? null
  const extraLocations = data?.locations ? data.locations.length - 1 : 0

  return (
    <>
      {/* 桌機版 — 原樣 */}
      <div
        className="hidden md:flex"
        style={{
          height: 130, borderRadius: 14, border: '1px solid var(--border-soft)',
          background: 'var(--surface-card)', overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <DesktopImage src={displayImage} alt={contextLabel} gradient={gradient} />
        <div className="flex flex-1 flex-col justify-center p-4 min-w-0 min-h-0">
          <div className="flex flex-col gap-0">
            {data && (
              <span className="text-xs text-muted-foreground">
                {formatDate(data.start_date)} ~ {formatDate(data.end_date)}
              </span>
            )}
            <h3 className="text-base font-bold leading-snug line-clamp-1" style={{ fontFamily: '"微软雅黑", "Microsoft YaHei", sans-serif' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', paddingRight: 14 }}>
          <ViewButton href={href} />
        </div>
      </div>

      {/* 手機版 — 整張可點 + 箭頭,不顯示日期 */}
      <MobileShell href={href}>
        <MobileImage src={displayImage} alt={contextLabel} gradient={gradient} />
        <div className="flex flex-1 flex-col justify-center px-3 py-2 min-w-0">
          <h3 className="text-sm font-bold leading-snug line-clamp-1" style={{ fontFamily: '"微软雅黑", "Microsoft YaHei", sans-serif' }}>
            {contextLabel}
          </h3>
          {data && (data.region?.name || (data.locations && data.locations.length > 0)) && (
            <div className="flex items-center gap-1 mt-1 min-w-0">
              {data.region?.name && (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary shrink-0">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  {data.region.name}
                </span>
              )}
              {data.locations?.[0] && (
                <span className="truncate rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {data.locations[0]}
                </span>
              )}
              {extraLocations > 0 && (
                <span className="text-[11px] text-muted-foreground shrink-0">+{extraLocations}</span>
              )}
            </div>
          )}
        </div>
      </MobileShell>
    </>
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
    <>
      {/* 桌機版 — 原樣 */}
      <div
        className="hidden md:flex"
        style={{
          height: 130, borderRadius: 14, border: '1px solid var(--border-soft)',
          background: 'var(--surface-card)', overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <DesktopImage src={displayImage} alt={contextLabel} gradient={gradient} />
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

      {/* 手機版 — 整張可點 + 箭頭 */}
      <MobileShell href={href}>
        <MobileImage src={displayImage} alt={contextLabel} gradient={gradient} />
        <div className="flex flex-1 flex-col justify-center px-3 py-2 min-w-0">
          <div className="grid gap-0.5">
            {brandLabel && (
              <p className="truncate text-[11px] font-medium leading-none text-muted-foreground">{brandLabel}</p>
            )}
            <h3 className="line-clamp-2 text-sm font-bold leading-snug">{contextLabel}</h3>
          </div>
          {data && (
            <div className="pt-1">
              <span className="text-sm font-semibold text-primary">
                {formatPrice(data.price, data.is_price_on_request)}
              </span>
            </div>
          )}
        </div>
      </MobileShell>
    </>
  )
}

export function ContextCard({ contextType, contextId, contextLabel, imageUrl }: Props) {
  if (contextType === 'connection') {
    return <ConnectionContextCard contextId={contextId} contextLabel={contextLabel} imageUrl={imageUrl} />
  }
  return <ListingContextCard contextId={contextId} contextLabel={contextLabel} imageUrl={imageUrl} />
}
