import Link from 'next/link'
import { Heart } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatPrice, PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'

interface ProductCardProps {
  product: {
    id: string
    name: string
    brand?: string | null
    category: string
    wish_count: number
    catalog_image?: { url: string } | null
    lowest_price?: number | null
    listing_count?: number
  }
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/products/${product.id}`}>
      <Card className="group overflow-hidden transition-shadow hover:shadow-md">
        <div className="aspect-square overflow-hidden bg-muted">
          {product.catalog_image?.url ? (
            <img
              src={product.catalog_image.url}
              alt={product.name}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              暫無圖片
            </div>
          )}
        </div>
        <CardContent className="p-3">
          <Badge variant="secondary" className="mb-1 text-xs">
            {PRODUCT_CATEGORY_LABELS[product.category] ?? product.category}
          </Badge>
          <h3 className="line-clamp-2 text-sm font-medium leading-tight">{product.name}</h3>
          {product.brand && (
            <p className="mt-0.5 text-xs text-muted-foreground">{product.brand}</p>
          )}
          <div className="mt-2 flex items-center justify-between">
            {product.lowest_price != null ? (
              <span className="text-sm font-bold text-primary">
                {formatPrice(product.lowest_price, false)}
              </span>
            ) : product.listing_count && product.listing_count > 0 ? (
              <span className="text-sm text-muted-foreground">私訊報價</span>
            ) : (
              <span className="text-sm text-muted-foreground">尚無報價</span>
            )}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Heart className="h-3 w-3" />
              {product.wish_count}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
