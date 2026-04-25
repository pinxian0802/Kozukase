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
        'group overflow-hidden rounded-2xl bg-white shadow-md transition-shadow duration-200 hover:shadow-lg',
        variant === 'compact' ? 'flex items-center gap-3 p-3' : 'p-3',
        className
      )}
    >
      <div className={variant === 'compact' ? 'relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white' : 'pb-0'}>
        {variant !== 'compact' && (
          <div className="relative aspect-square overflow-hidden rounded-xl bg-white">
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
              <div className="flex h-full items-center justify-center bg-white text-muted-foreground/40">
                <Package className="h-8 w-8" />
              </div>
            )}
          </div>
        )}
        {variant === 'compact' && (
          <div className="relative h-full w-full overflow-hidden rounded-xl bg-white">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={product.name}
                fill
                sizes="80px"
                className="object-cover transition-transform duration-200 group-hover:scale-105"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-white text-muted-foreground/40">
                <Package className="h-8 w-8" />
              </div>
            )}
          </div>
        )}
      </div>

      <div className={variant === 'compact' ? 'min-w-0 flex-1 py-0.5' : 'pt-2'}>
        <div className={variant === 'compact' ? 'grid min-h-[4.25rem] gap-1' : 'grid min-h-[3.5rem] gap-1'}>
          <div className={variant === 'compact' ? 'h-4 overflow-hidden' : 'h-4 overflow-hidden'}>
            {brandLabel ? (
              <p className={variant === 'compact' ? 'truncate text-[11px] font-medium leading-none text-muted-foreground' : 'truncate text-xs font-medium leading-none text-muted-foreground'}>{brandLabel}</p>
            ) : (
              <span aria-hidden="true" className={variant === 'compact' ? 'block h-4' : 'block h-4'} />
            )}
          </div>
          <div className={variant === 'compact' ? 'h-[1.25rem] overflow-hidden' : 'h-[1.25rem] overflow-hidden'}>
            <p className={variant === 'compact' ? 'line-clamp-1 text-[14px] font-semibold leading-tight text-foreground' : 'line-clamp-1 text-[15px] font-semibold leading-tight text-foreground'}>{product.name}</p>
          </div>
          <div className={variant === 'compact' ? 'h-4 overflow-hidden' : 'h-4 overflow-hidden'}>
            {product.model_number ? (
              <p className={variant === 'compact' ? 'truncate text-[11px] leading-none text-muted-foreground' : 'truncate text-xs leading-none text-muted-foreground'}>{product.model_number}</p>
            ) : (
              <span aria-hidden="true" className={variant === 'compact' ? 'block h-4' : 'block h-4'} />
            )}
          </div>
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
