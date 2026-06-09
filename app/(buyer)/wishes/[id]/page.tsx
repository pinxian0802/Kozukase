'use client'

import { use } from 'react'
import Link from 'next/link'
import { Heart, Package, ChevronRight, HeartCrack } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { EmptyState } from '@/components/shared/empty-state'
import { ImageGallery } from '@/components/shared/image-gallery'
import { PageBreadcrumb } from '@/components/shared/page-breadcrumb'
import { SharePopover } from '@/components/shared/share-popover'
import { WishDetailSkeleton } from '@/components/buyer/skeletons/wish-detail-skeleton'
import { trpc } from '@/lib/trpc/client'
import { formatDate, PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'

export default function WishDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const { data: wish, isLoading } = trpc.wish.getById.useQuery({ id })

  if (isLoading) {
    return <WishDetailSkeleton />
  }

  if (!wish || !wish.product) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-6">
        <EmptyState icon={HeartCrack} title="找不到此許願" description="此許願已被刪除或頁面已失效">
          <Link
            href="/wishes"
            className="inline-flex h-10 items-center justify-center rounded-lg px-6 text-sm font-semibold text-white transition-all hover:opacity-85 active:scale-[0.98]"
            style={{ background: 'var(--brand-700)' }}
          >
            瀏覽許願榜
          </Link>
        </EmptyState>
      </div>
    )
  }

  const product = wish.product as any
  const profile = (Array.isArray(wish.profile) ? wish.profile[0] : wish.profile) as
    | { display_name: string | null; avatar_url: string | null }
    | null
  const brandName = typeof product.brand === 'string' ? product.brand : product.brand?.name ?? null
  const categoryLabel = product.category ? PRODUCT_CATEGORY_LABELS[product.category] ?? product.category : null
  const wisherName = profile?.display_name ?? '匿名'

  const catalogImage = Array.isArray(product.catalog_image) ? product.catalog_image[0] : product.catalog_image
  const galleryImages = [
    ...(catalogImage ? [{ url: catalogImage.url, alt: product.name }] : []),
    ...((product.product_images ?? []) as any[])
      .filter((image) => image.id !== catalogImage?.id)
      .map((image) => ({ url: image.url, alt: product.name })),
  ]

  return (
    <div className="mx-auto max-w-5xl px-3 py-3 md:px-6 md:py-6">
      <PageBreadcrumb items={[
        { label: '許願榜', href: '/wishes' },
        { label: product.name },
      ]} />

      <div className="grid items-start gap-3 md:grid-cols-[1fr_1.15fr] md:gap-12">

        {/* Gallery — sticky on desktop */}
        <div className="space-y-3 md:sticky md:top-20">
          <ImageGallery
            images={galleryImages}
            title="商品圖片"
            emptyTitle="暫無圖片"
            emptyDescription="這個商品目前沒有圖片"
          />
        </div>

        {/* Details */}
        <div className="flex min-w-0 flex-col gap-3 md:gap-7">

          {/* Header block */}
          <div className="flex flex-col gap-1 md:gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-muted-foreground md:text-sm">
              {brandName && <span className="text-foreground">{brandName}</span>}
              {brandName && categoryLabel && <span className="text-muted-foreground/40">·</span>}
              {categoryLabel && <span>{categoryLabel}</span>}
            </div>
            <h1 className="text-[15px] font-bold leading-snug md:text-xl">{product.name}</h1>
            {product.model_number && (
              <p className="text-[11px] text-muted-foreground md:text-sm">型號：{product.model_number}</p>
            )}
          </div>

          {/* Wish content card */}
          <div className="rounded-lg p-3 md:rounded-2xl md:p-5" style={{ background: 'var(--brand-50)' }}>
            <div
              className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-widest md:mb-2 md:text-[11px]"
              style={{ color: 'var(--brand-900)' }}
            >
              <Heart className="h-3 w-3 md:h-3.5 md:w-3.5" /> 許願內容
            </div>
            <p
              className="whitespace-pre-wrap break-words text-[13px] font-medium leading-relaxed md:text-base"
              style={{ color: 'var(--brand-700)' }}
            >
              {wish.content}
            </p>
          </div>

          {/* Wisher */}
          <div className="flex items-center gap-2.5 rounded-lg border border-border-soft bg-background p-3 md:gap-3 md:rounded-2xl md:p-4">
            <Avatar className="h-9 w-9 shrink-0 md:h-12 md:w-12">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="text-sm font-semibold md:text-lg">{wisherName[0]}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-foreground md:text-base">{wisherName}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground md:text-xs">於 {formatDate(wish.created_at)} 許願</p>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex gap-1.5 md:gap-2">
            <Link
              href={`/products/${product.id}`}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-[12px] font-semibold text-white transition-all hover:opacity-85 active:scale-[0.98] md:h-12 md:gap-2 md:rounded-xl md:text-sm"
              style={{ background: 'var(--brand-700)' }}
            >
              <Package className="h-3.5 w-3.5 md:h-4 md:w-4" /> 查看此商品
              <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </Link>
            <SharePopover title={`${product.name} 的許願`} />
          </div>
        </div>
      </div>
    </div>
  )
}
