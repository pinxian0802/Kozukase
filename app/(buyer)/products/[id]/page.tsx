'use client'

import { use } from 'react'
import { Heart, Bookmark, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ListingComparison } from '@/components/product/listing-comparison'
import { EmptyState } from '@/components/shared/empty-state'
import { trpc } from '@/lib/trpc/client'
import { PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const utils = trpc.useUtils()
  const { data: product, isLoading } = trpc.product.getById.useQuery({ id })

  const wishToggle = trpc.wish.toggle.useMutation({
    onSuccess: () => utils.product.getById.invalidate({ id }),
    onError: (err) => toast.error(err.message),
  })

  const bookmarkToggle = trpc.bookmark.toggleProductBookmark.useMutation({
    onSuccess: () => utils.product.getById.invalidate({ id }),
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <EmptyState icon={Heart} title="找不到此商品" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <Button variant="ghost" size="sm" render={<Link href="/search" />}>
        <ArrowLeft className="mr-1 h-4 w-4" />返回搜尋
      </Button>

      {/* Product Info */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Catalog Image */}
        <div className="w-full md:w-80 flex-shrink-0">
          <div className="aspect-square overflow-hidden rounded-xl bg-muted">
            {product.catalog_image?.url ? (
              <img src={product.catalog_image.url} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">暫無圖片</div>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <Badge variant="secondary">{PRODUCT_CATEGORY_LABELS[product.category] ?? product.category}</Badge>
          <h1 className="text-3xl font-bold font-heading">{product.name}</h1>
          {product.brand && <p className="text-muted-foreground">{product.brand}</p>}

          <div className="flex gap-3">
            <Button
              variant={product.hasWished ? 'default' : 'outline'}
              onClick={() => wishToggle.mutate({ product_id: id })}
              disabled={wishToggle.isPending}
            >
              <Heart className={`mr-2 h-4 w-4 ${product.hasWished ? 'fill-current' : ''}`} />
              許願 ({product.wish_count})
            </Button>
            <Button
              variant={product.hasBookmarked ? 'default' : 'outline'}
              onClick={() => bookmarkToggle.mutate({ product_id: id })}
              disabled={bookmarkToggle.isPending}
            >
              <Bookmark className={`mr-2 h-4 w-4 ${product.hasBookmarked ? 'fill-current' : ''}`} />
              收藏
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Listing Comparison */}
      <div>
        <h2 className="text-xl font-bold font-heading mb-4">
          代購比較 {product.listings?.length > 0 && `(${product.listings.length})`}
        </h2>
        <ListingComparison listings={product.listings ?? []} />
      </div>
    </div>
  )
}
