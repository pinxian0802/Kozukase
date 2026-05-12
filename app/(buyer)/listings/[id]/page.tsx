'use client'

import { use } from 'react'
import { Bookmark, ExternalLink, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CopyButton } from '@/components/shared/copy-button'
import { ReportDialog } from '@/components/shared/report-dialog'
import { SharePopover } from '@/components/shared/share-popover'
import { ImageGallery } from '@/components/shared/image-gallery'
import { SafeExternalLink } from '@/components/shared/safe-external-link'
import { Skeleton } from '@/components/ui/skeleton'
import { trpc } from '@/lib/trpc/client'
import { formatPrice, formatShippingDate } from '@/lib/utils/format'
import { PageBreadcrumb } from '@/components/shared/page-breadcrumb'
import { useSession } from '@/lib/context/session-context'
import { useRouter } from 'next/navigation'

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const session = useSession()
  const router = useRouter()
  const utils = trpc.useUtils()
  const { data: listing, isLoading } = trpc.listing.getById.useQuery({ id })

  const bookmarkToggle = trpc.bookmark.toggleListingBookmark.useMutation({
    onSuccess: () => utils.listing.getById.invalidate({ id }),
  })

  const handleBookmark = () => {
    if (!session) {
      router.push('/login')
      return
    }
    bookmarkToggle.mutate({ listing_id: id })
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-8 w-64" />
      </div>
    )
  }

  if (!listing) return null

  const images = listing.listing_images?.sort((a: any, b: any) => a.sort_order - b.sort_order) ?? []
  const galleryImages = images.map((image: any) => ({
    url: image.url,
    alt: listing.product?.name ?? '刊登圖片',
  }))
  const inquiryText = `你好，我想詢問 ${listing.product?.name ?? '商品'} 的代購，請問還有在收單嗎？`

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <PageBreadcrumb items={[
        { label: '代購', href: '/search' },
        { label: listing.product?.name ?? '代購詳情', href: listing.product ? `/products/${listing.product.id}` : undefined },
        { label: listing.title ?? '代購詳情' },
      ]} />

      <div className="grid gap-8 md:grid-cols-2">
        {/* Images */}
        <div className="space-y-3">
          <ImageGallery
            images={galleryImages}
            title="刊登圖片"
            emptyTitle="暫無刊登圖片"
            emptyDescription="這則刊登目前沒有上傳圖片"
          />
        </div>

        {/* Details */}
        <div className="space-y-6">
          {listing.product && (
            <Link href={`/products/${listing.product.id}`} className="text-sm text-primary hover:underline">
              {listing.product.name}
            </Link>
          )}

          {/* Price */}
          <div>
            <p className="text-3xl font-bold text-foreground tabular-nums">
              {formatPrice(listing.price, listing.is_price_on_request)}
            </p>
            <Badge variant="outline" className="mt-2">
              {formatShippingDate(listing.shipping_date)}
            </Badge>
          </div>

          {/* Specs */}
          {listing.specs && listing.specs.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">規格</h3>
              <div className="space-y-2.5">
                {listing.specs.map((spec: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground shrink-0">{spec.type}：</span>
                    {spec.is_all ? (
                      <span className="inline-flex items-center rounded-[min(var(--radius-md),12px)] border border-[#e2e2e2] bg-muted px-2.5 py-1 text-xs font-medium">都有</span>
                    ) : (
                      spec.options?.map((opt: string, j: number) => (
                        <span key={j} className="inline-flex items-center rounded-[min(var(--radius-md),12px)] border border-[#e2e2e2] bg-muted px-2.5 py-1 text-xs font-medium">{opt}</span>
                      ))
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Note */}
          {listing.note && (
            <div>
              <h3 className="font-medium mb-1">備註</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">{listing.note}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2.5">
            <CopyButton text={inquiryText} label="複製詢問語" />
            {listing.post_url && (
              <SafeExternalLink href={listing.post_url} className="w-full justify-center gap-2 h-12 rounded-xl text-sm font-semibold">
                <ExternalLink className="h-4 w-4" /> 查看原始貼文
              </SafeExternalLink>
            )}
            <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 44px 44px' }}>
              <button
                onClick={handleBookmark}
                disabled={bookmarkToggle.isPending}
                className="h-11 rounded-xl border text-sm font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 hover:opacity-80 active:scale-[0.98]"
                style={{
                  background: listing.hasBookmarked ? 'rgba(74,176,169,0.08)' : 'transparent',
                  color: listing.hasBookmarked ? '#4ab0a9' : '#444',
                  borderColor: listing.hasBookmarked ? 'rgba(74,176,169,0.4)' : '#e2e2e2',
                }}
              >
                <Bookmark className="h-4 w-4" fill={listing.hasBookmarked ? 'currentColor' : 'none'} />
                {listing.hasBookmarked ? '已收藏' : '收藏'}
              </button>
              <SharePopover title={listing.product?.name ?? listing.title ?? ''} />
              <ReportDialog
                listing_id={id}
                iconOnly
                triggerClassName="h-11 w-11 rounded-xl border-[#e2e2e2] text-muted-foreground hover:bg-muted/50 active:scale-[0.96] transition-all cursor-pointer"
              />
            </div>
          </div>

          {/* Seller info */}
          {listing.seller && (
            <div className="bg-background border border-[#ececec] rounded-2xl p-4 flex flex-col gap-3.5">
              <Link href={`/sellers/${listing.seller.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <Avatar className="h-14 w-14 shrink-0">
                  <AvatarImage src={(listing.seller as any).avatar_url ?? undefined} />
                  <AvatarFallback className="font-semibold text-xl">{listing.seller.name?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <span className="font-semibold text-foreground text-base">{listing.seller.name}</span>
                  {(listing.seller as any).profile?.username && (
                    <p className="text-xs text-muted-foreground mt-0.5">@{(listing.seller as any).profile.username}</p>
                  )}
                </div>
              </Link>
              <div className="border-t border-[#f0f0f0] pt-3">
                <Link
                  href={`/sellers/${listing.seller.id}`}
                  className="w-full h-9 rounded-lg border border-[#e2e2e2] bg-background text-sm font-medium text-[#444] flex items-center justify-center gap-1.5 hover:bg-muted/50 transition-colors"
                >
                  查看賣家主頁 <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
