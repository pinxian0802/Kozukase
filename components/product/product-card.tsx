import Link from 'next/link'
import Image from 'next/image'
import { Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCardImageUrl } from '@/lib/utils/image-variants.mjs'

export type ProductCardProduct = {
  id: string
  name: string
  brand?: string | { name: string } | null
  model_number?: string | null
  catalog_image?: { url: string; thumbnail_url?: string | null } | null
  catalog_image_url?: string | null
  product_images?: { url: string; thumbnail_url?: string | null }[]
  wish_count?: number | null
}

type ProductCardProps = {
  product: ProductCardProduct
  href?: string
  linkToProduct?: boolean
  onClick?: () => void
  className?: string
  variant?: 'default' | 'compact'
  imageAspect?: '4/5' | '3/4' | '2/3' | '1/1' | '5/4'
}

const IMAGE_ASPECT_CLASS: Record<'4/5' | '3/4' | '2/3' | '1/1' | '5/4', string> = {
  '4/5': 'aspect-[4/5]',
  '3/4': 'aspect-[3/4]',
  '2/3': 'aspect-[2/3]',
  '1/1': 'aspect-square',
  '5/4': 'aspect-[5/4]',
}

export function ProductCard({ product, href, linkToProduct = true, onClick, className, variant = 'default', imageAspect = '1/1' }: ProductCardProps) {
  const imageUrl = getCardImageUrl(product)
  const isLocalPreviewUrl = imageUrl?.startsWith('blob:') || imageUrl?.startsWith('data:')
  const brandLabel = typeof product.brand === 'string' ? product.brand : product.brand?.name ?? null

  const card = (
    <div
      className={cn(
        '@container group relative overflow-hidden rounded-xl border border-border-soft bg-white shadow-none md:rounded-2xl md:border-0 md:shadow-sm md:transition-shadow md:duration-200 md:hover:shadow-md',
        variant === 'compact' ? 'flex items-center gap-4 p-5' : '',
        className
      )}
    >
      {/* Default variant: full-width square image */}
      {variant !== 'compact' && (
        <div className={cn('relative bg-muted', IMAGE_ASPECT_CLASS[imageAspect])}>
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-200 group-hover:scale-105"
              unoptimized={isLocalPreviewUrl}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground/30">
              <Package className="h-7 w-7" />
            </div>
          )}
        </div>
      )}

      {/* Compact variant: small thumbnail */}
      {variant === 'compact' && (
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              sizes="96px"
              className="object-cover"
              unoptimized={isLocalPreviewUrl}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground/30">
              <Package className="h-6 w-6" />
            </div>
          )}
        </div>
      )}

      {/* Text content */}
      {variant === 'compact' ? (
        <div className="min-w-0 flex-1">
          {brandLabel && (
            <p className="truncate text-[clamp(0.62rem,3cqi,0.75rem)] text-muted-foreground mb-1">{brandLabel}</p>
          )}
          <p className="line-clamp-2 font-bold leading-snug text-foreground text-[clamp(0.8rem,4.3cqi,1rem)]" style={{ fontFamily: '"微软雅黑", "Microsoft YaHei", sans-serif' }}>{product.name}</p>
        </div>
      ) : (
        <>
          {/* 佔位:在 flex flow 撐出 name 區高度,卡片總高 = 圖片 + 此佔位 */}
          {/* Mobile: simple inline text */}
          <div className="flex min-h-[4.5rem] flex-col justify-end px-3 py-2.5 md:hidden">
            {brandLabel && <p className="mb-0.5 truncate text-[11px] text-text-muted">{brandLabel}</p>}
            <p className="line-clamp-2 text-[14px] font-medium leading-snug text-foreground" style={{ fontFamily: '"微软雅黑", "Microsoft YaHei", sans-serif' }}>{product.name}</p>
          </div>
          {/* Desktop: absolute overlay with hover expand */}
          <div aria-hidden className="invisible bg-white px-4 py-3 hidden md:block">
            <p className="line-clamp-2 min-h-[2.75rem] font-bold leading-snug text-[clamp(0.72rem,7cqi,1rem)]">.</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 hidden min-h-[4.25rem] flex-col justify-end bg-white px-4 py-3 md:flex">
            {brandLabel && (
              <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-200">
                <div className="overflow-hidden">
                  <p className="truncate text-xs text-muted-foreground pb-1">{brandLabel}</p>
                </div>
              </div>
            )}
            <p className="line-clamp-2 font-bold leading-snug text-foreground text-[clamp(0.72rem,7cqi,1rem)]" style={{ fontFamily: '"微软雅黑", "Microsoft YaHei", sans-serif' }}>{product.name}</p>
          </div>
        </>
      )}
    </div>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full cursor-pointer text-left focus-visible:outline-none"
      >
        {card}
      </button>
    )
  }

  if (linkToProduct) {
    return (
      <Link href={href ?? `/products/${product.id}`} className="block w-full">
        {card}
      </Link>
    )
  }

  return card
}
