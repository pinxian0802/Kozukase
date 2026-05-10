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
}

export function ProductCard({ product, href, linkToProduct = true, onClick, className, variant = 'default' }: ProductCardProps) {
  const imageUrl = getCardImageUrl(product)
  const isLocalPreviewUrl = imageUrl?.startsWith('blob:') || imageUrl?.startsWith('data:')
  const brandLabel = typeof product.brand === 'string' ? product.brand : product.brand?.name ?? null

  const card = (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl bg-white shadow-sm transition-shadow duration-200 hover:shadow-md',
        variant === 'compact' ? 'flex items-center gap-4 p-5' : '',
        className
      )}
    >
      {/* Default variant: full-width square image */}
      {variant !== 'compact' && (
        <div className="relative aspect-[4/5] bg-muted">
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
      <div className={variant === 'compact' ? 'min-w-0 flex-1' : 'absolute bottom-0 left-0 right-0 bg-white px-4 pb-3 pt-4'}>
        {variant === 'compact' ? (
          <div>
            {brandLabel && (
              <p className="truncate text-xs text-muted-foreground mb-1.5">{brandLabel}</p>
            )}
            <p className="line-clamp-2 font-bold leading-snug text-foreground text-base" style={{ fontFamily: 'var(--font-sans-tc), "微软雅黑", "Microsoft YaHei", sans-serif' }}>{product.name}</p>
            {product.model_number && (
              <p className="text-xs text-muted-foreground mt-0.5 break-all">{product.model_number}</p>
            )}
          </div>
        ) : (
          <div>
            {/* Brand — expands from 0 height on hover */}
            {brandLabel && (
              <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-200">
                <div className="overflow-hidden">
                  <p className="truncate text-xs text-muted-foreground pb-0.5">{brandLabel}</p>
                </div>
              </div>
            )}
            <p className="line-clamp-2 font-bold leading-snug text-foreground text-base" style={{ fontFamily: 'var(--font-sans-tc), "微软雅黑", "Microsoft YaHei", sans-serif' }}>{product.name}</p>
            {/* Model — expands from 0 height on hover */}
            {product.model_number && (
              <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-200">
                <div className="overflow-hidden">
                  <p className="truncate text-xs leading-tight text-muted-foreground">{product.model_number}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
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
