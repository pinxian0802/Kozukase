import Link from 'next/link'
import Image from 'next/image'
import { Package } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ProductCardProduct = {
  id: string
  name: string
  brand?: string | { name: string } | null
  model_number?: string | null
  catalog_image?: { url: string } | null
  catalog_image_url?: string | null
  product_images?: { url: string }[]
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
  const imageUrl = product.catalog_image?.url ?? product.catalog_image_url ?? product.product_images?.[0]?.url ?? null
  const brandLabel = typeof product.brand === 'string' ? product.brand : product.brand?.name ?? null

  const card = (
    <div
      className={cn(
        'group overflow-hidden rounded-md border border-border bg-white transition-colors duration-200 hover:border-foreground/30',
        variant === 'compact' ? 'flex items-center gap-3 p-3' : 'p-3',
        className
      )}
    >
      <div className={variant === 'compact' ? 'relative h-16 w-16 shrink-0 overflow-hidden rounded-sm bg-muted' : 'pb-0'}>
        {variant !== 'compact' && (
          <div className="relative aspect-square overflow-hidden rounded-sm bg-muted">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition-transform duration-200 group-hover:scale-105"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground/30">
                <Package className="h-7 w-7" />
              </div>
            )}
          </div>
        )}
        {variant === 'compact' && (
          <div className="relative h-full w-full overflow-hidden rounded-sm bg-muted">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={product.name}
                fill
                sizes="64px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground/30">
                <Package className="h-6 w-6" />
              </div>
            )}
          </div>
        )}
      </div>

      <div className={variant === 'compact' ? 'min-w-0 flex-1' : 'pt-2'}>
        <div className="grid gap-0.5">
          {brandLabel && (
            <p className="truncate text-xs text-muted-foreground">{brandLabel}</p>
          )}
          <p className={cn(
            'line-clamp-2 font-medium leading-snug text-foreground',
            variant === 'compact' ? 'text-sm' : 'text-sm'
          )}>{product.name}</p>
          {product.model_number && (
            <p className="truncate text-xs text-muted-foreground">{product.model_number}</p>
          )}
        </div>
      </div>
    </div>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left focus-visible:outline-none"
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
