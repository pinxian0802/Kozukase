import Link from 'next/link'
import Image from 'next/image'
import { Package, Heart } from 'lucide-react'
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
        'group overflow-hidden rounded-2xl bg-white shadow-sm transition-shadow duration-200 hover:shadow-md',
        variant === 'compact' ? 'flex items-center gap-4 p-5' : '',
        className
      )}
    >
      <div className={variant === 'compact' ? 'relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted' : 'pb-0'}>
        {variant !== 'compact' && (
          <div className="relative aspect-square overflow-hidden rounded-t-2xl bg-muted">
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
        {variant === 'compact' && (
          <div className="relative h-full w-full overflow-hidden rounded-xl bg-muted">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={product.name}
                fill
                sizes="64px"
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
      </div>

      <div className={variant === 'compact' ? 'min-w-0 flex-1' : 'px-3 pt-2 pb-3'}>
        {variant === 'compact' ? (
          <div>
            {brandLabel && (
              <p className="truncate text-xs text-muted-foreground mb-1.5">{brandLabel}</p>
            )}
            <p className="line-clamp-2 font-medium leading-snug text-foreground text-base">{product.name}</p>
            {product.model_number && (
              <p className="text-xs text-muted-foreground mt-0.5 break-all">{product.model_number}</p>
            )}
          </div>
        ) : (
          <div className="grid gap-0">
            {brandLabel && (
              <p className="truncate text-xs text-muted-foreground mb-0.5">{brandLabel}</p>
            )}
            <p className="line-clamp-2 font-medium leading-tight text-foreground text-sm">{product.name}</p>
            {product.model_number && (
              <p className="truncate text-xs leading-tight text-muted-foreground">{product.model_number}</p>
            )}
            {!!product.wish_count && (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Heart className="h-3 w-3 fill-current" />
                {product.wish_count} 人許願
              </p>
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
