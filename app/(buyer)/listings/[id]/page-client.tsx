'use client'

import { use, useEffect } from 'react'
import Image from 'next/image'
import { Bookmark, ExternalLink, ChevronRight, MessageSquare, Truck } from 'lucide-react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SocialBadge } from '@/components/seller/social-badge'
import { CopyButton } from '@/components/shared/copy-button'
import { ReportDialog } from '@/components/shared/report-dialog'
import { SharePopover } from '@/components/shared/share-popover'
import { ImageGallery } from '@/components/shared/image-gallery'
import { SafeExternalLink } from '@/components/shared/safe-external-link'
import { Skeleton } from '@/components/ui/skeleton'
import { trpc } from '@/lib/trpc/client'
import { formatPrice, formatDate, formatLastSeen } from '@/lib/utils/format'
import { PageBreadcrumb } from '@/components/shared/page-breadcrumb'
import { useSession } from '@/lib/context/session-context'
import { useRouter } from 'next/navigation'

export default function ListingPageClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const session = useSession()
  const router = useRouter()
  const utils = trpc.useUtils()
  const { data: listing, isLoading } = trpc.listing.getById.useQuery({ id })

  const bookmarkToggle = trpc.bookmark.toggleListingBookmark.useMutation({
    onSuccess: () => utils.listing.getById.invalidate({ id }),
  })

  const recordView = trpc.analytics.recordListingView.useMutation()

  useEffect(() => {
    if (!listing) return
    // 不記錄賣家自己瀏覽
    if (session?.user?.id === listing.seller_id) return
    // Session 內 dedup
    const key = `lv_${id}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    recordView.mutate({ listing_id: id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing])

  const handleBookmark = () => {
    if (!session) {
      router.push('/login')
      return
    }
    bookmarkToggle.mutate({ listing_id: id })
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-6 space-y-6">
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
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageBreadcrumb items={[
        { label: '代購', href: '/search' },
        { label: listing.product?.name ?? '代購詳情', href: listing.product ? `/products/${listing.product.id}` : undefined },
        { label: listing.title ?? '代購詳情' },
      ]} />

      <div className="grid gap-12 md:grid-cols-[1fr_1.15fr] items-start">

        {/* Images */}
        <div className="md:sticky md:top-20 space-y-3">
          <ImageGallery
            images={galleryImages}
            title="刊登圖片"
            emptyTitle="暫無刊登圖片"
            emptyDescription="這則刊登目前沒有上傳圖片"
          />
        </div>

        {/* Details */}
        <div className="space-y-6 min-w-0">

          <div className="flex items-start gap-3">
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              {listing.product && (
                <Link href={`/products/${listing.product.id}`} className="text-sm text-primary hover:underline">
                  {listing.product.name}
                </Link>
              )}
              {listing.title && (
                <h1 className="text-xl font-bold leading-snug">{listing.title}</h1>
              )}
            </div>
            <button
              onClick={handleBookmark}
              disabled={bookmarkToggle.isPending}
              className="shrink-0 self-start h-9 w-9 flex items-center justify-center rounded-full transition-all cursor-pointer disabled:opacity-60 hover:opacity-70 active:scale-[0.95]"
              style={{ color: listing.hasBookmarked ? '#4ab0a9' : '#aaa' }}
            >
              <Bookmark className="h-5 w-5" fill={listing.hasBookmarked ? 'currentColor' : 'none'} />
            </button>
          </div>

          {/* Price */}
          <div>
            <p className="text-3xl font-bold tabular-nums" style={{ color: '#1a9ac4' }}>
              {formatPrice(listing.price, listing.is_price_on_request)}
            </p>
            {listing.shipping_date && (
              <div className="mt-3 bg-background border border-[#ececec] rounded-2xl px-5 py-4">
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Truck className="h-4 w-4 shrink-0" />
                  <span>預計 <strong className="text-foreground">{formatDate(listing.shipping_date)}</strong> 出貨</span>
                </div>
              </div>
            )}
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
              <h3 className="font-medium mb-1">說明</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">{listing.note}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2.5">
            <div className="flex gap-2">
              {listing.post_url && (
                <SafeExternalLink href={listing.post_url} className="flex-1 justify-center gap-2 h-12 rounded-xl text-sm font-semibold hover:opacity-85 active:scale-[0.98]" style={{ background: '#1a9ac4' }}>
                  <ExternalLink className="h-4 w-4" /> 查看原始貼文
                </SafeExternalLink>
              )}
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
            <div className="bg-background border border-[#ececec] rounded-2xl p-4 flex items-center gap-3">
              <Link href={`/sellers/${listing.seller.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-1 min-w-0">
                <Avatar className="h-14 w-14 shrink-0">
                  <AvatarImage src={(listing.seller as any).avatar_url ?? undefined} />
                  <AvatarFallback className="font-semibold text-xl">{listing.seller.name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground text-lg truncate">{listing.seller.name}</span>
                    {(listing.seller as any).is_social_verified && <SocialBadge className="h-3 w-3 text-primary shrink-0" />}
                  </div>
                  {formatLastSeen((listing.seller as any).profile?.last_seen_at) && (
                    <p className="text-xs text-muted-foreground mt-0.5">{formatLastSeen((listing.seller as any).profile?.last_seen_at)}</p>
                  )}
                </div>
              </Link>
              <div className="flex flex-col gap-1.5 shrink-0">
                <Link
                  href={`/sellers/${listing.seller.id}`}
                  className="h-10 px-6 min-w-[88px] rounded-lg border border-[#e2e2e2] bg-background text-sm font-medium text-[#444] flex items-center justify-center gap-1.5 hover:bg-muted/50 transition-colors"
                >
                  主頁 <ChevronRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href={`/messages?seller_id=${listing.seller.id}&seller_name=${encodeURIComponent((listing.seller as any).profile?.display_name ?? listing.seller.name ?? '')}&seller_avatar=${encodeURIComponent((listing.seller as any).avatar_url ?? '')}&context_type=listing&context_id=${listing.id}&context_label=${encodeURIComponent(listing.title ?? listing.product?.name ?? '商品')}${images[0]?.url ? `&context_image=${encodeURIComponent(images[0].url)}` : ''}`}
                  className="h-10 px-6 min-w-[88px] rounded-lg border border-[#e2e2e2] bg-background text-sm font-medium text-[#444] flex items-center justify-center gap-1.5 hover:bg-muted/50 transition-colors"
                >
                  詢問 <MessageSquare className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
