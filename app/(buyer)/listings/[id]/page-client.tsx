'use client'

import { use, useEffect } from 'react'
import Image from 'next/image'
import { Bookmark, ExternalLink, ChevronRight, MessageSquare, Truck, PackageOpen } from 'lucide-react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SocialBadge } from '@/components/seller/social-badge'
import { CopyButton } from '@/components/shared/copy-button'
import { ReportDialog } from '@/components/shared/report-dialog'
import { SharePopover } from '@/components/shared/share-popover'
import { ImageGallery } from '@/components/shared/image-gallery'
import { SafeExternalLink } from '@/components/shared/safe-external-link'
import { ListingDetailSkeleton } from '@/components/buyer/skeletons/listing-detail-skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { formatPrice, formatDate, formatLastSeen } from '@/lib/utils/format'
import { PageBreadcrumb } from '@/components/shared/page-breadcrumb'
import { useSession } from '@/lib/context/session-context'
import { useRouter } from 'next/navigation'

export default function ListingPageClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const session = useSession()
  const router = useRouter()
  const utils = trpc.useUtils()
  const { data: listing, isLoading } = trpc.listing.getById.useQuery(
    { id },
    { retry: (count, err) => err.data?.code !== 'NOT_FOUND' && count < 3 }
  )

  const bookmarkToggle = trpc.bookmark.toggleListingBookmark.useMutation({
    onMutate: async () => {
      await utils.listing.getById.cancel({ id })
      const prev = utils.listing.getById.getData({ id })
      if (prev) {
        utils.listing.getById.setData({ id }, { ...prev, hasBookmarked: !prev.hasBookmarked })
      }
      return { prev }
    },
    onError: (err, _vars, context) => {
      if (context?.prev) utils.listing.getById.setData({ id }, context.prev)
      toast.error(err.message)
    },
    onSettled: () => utils.listing.getById.invalidate({ id }),
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
    return <ListingDetailSkeleton />
  }

  if (!listing) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-6">
        <EmptyState
          icon={PackageOpen}
          title="找不到此代購"
          description="此頁面已失效"
        >
          <Link
            href="/search?tab=listings"
            className="inline-flex h-10 items-center justify-center rounded-lg px-6 text-sm font-semibold text-white hover:opacity-85 active:scale-[0.98] transition-all"
            style={{ background: 'var(--brand-700)' }}
          >
            瀏覽其他代購
          </Link>
        </EmptyState>
      </div>
    )
  }

  const images = listing.listing_images?.sort((a: any, b: any) => a.sort_order - b.sort_order) ?? []
  const galleryImages = images.map((image: any) => ({
    url: image.url,
    alt: listing.product?.name ?? '刊登圖片',
  }))
  const inquiryText = `你好，我想詢問 ${listing.product?.name ?? '商品'} 的代購，請問還有在收單嗎？`

  return (
    <div className="mx-auto max-w-5xl px-3 py-3 md:px-6 md:py-6">
      <PageBreadcrumb items={[
        { label: '代購', href: '/search' },
        { label: listing.product?.name ?? '代購詳情', href: listing.product ? `/products/${listing.product.id}` : undefined },
        { label: listing.title ?? '代購詳情' },
      ]} />

      <div className="grid gap-3 md:grid-cols-[1fr_1.15fr] md:gap-12 items-start">

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
        <div className="space-y-3 min-w-0 md:space-y-6">

          <div className="flex items-start gap-2">
            <div className="flex-1 flex flex-col min-w-0">
              {listing.product && (
                <Link href={`/products/${listing.product.id}`} className="text-[11px] text-primary hover:underline md:text-sm">
                  {listing.product.name}
                </Link>
              )}
              {listing.title && (
                <h1 className="text-[15px] font-bold leading-snug mt-0.5 md:text-xl">{listing.title}</h1>
              )}
            </div>
            <button
              onClick={handleBookmark}
              disabled={bookmarkToggle.isPending}
              className="shrink-0 self-start h-8 w-8 flex items-center justify-center rounded-full transition-all cursor-pointer disabled:opacity-60 hover:opacity-70 active:scale-[0.95] md:h-9 md:w-9"
              style={{ color: listing.hasBookmarked ? 'var(--brand-500)' : 'var(--text-faint)' }}
            >
              <Bookmark className="h-4 w-4 md:h-5 md:w-5" fill={listing.hasBookmarked ? 'currentColor' : 'none'} />
            </button>
          </div>

          {/* Price */}
          <div>
            <p className="text-xl font-bold tabular-nums md:text-3xl" style={{ color: 'var(--brand-700)' }}>
              {formatPrice(listing.price, listing.is_price_on_request)}
            </p>
            {listing.shipping_date && (
              <div className="mt-2 bg-background border border-border-soft rounded-lg px-3 py-2 md:mt-3 md:rounded-2xl md:px-5 md:py-4">
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground md:text-sm md:gap-2.5">
                  <Truck className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" />
                  <span>預計 <strong className="text-foreground">{formatDate(listing.shipping_date)}</strong> 出貨</span>
                </div>
              </div>
            )}
          </div>

          {/* Specs */}
          {listing.specs && listing.specs.length > 0 && (
            <div className="space-y-1.5 md:space-y-2">
              <h3 className="text-[13px] font-medium md:text-base">規格</h3>
              <div className="space-y-1.5 md:space-y-2.5">
                {listing.specs.map((spec: any, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 flex-wrap md:gap-2">
                    <span className="text-[11px] text-muted-foreground shrink-0 md:text-sm">{spec.type}：</span>
                    {spec.is_all ? (
                      <span className="inline-flex items-center rounded-md border border-border-soft bg-muted px-2 py-0.5 text-[10px] font-medium md:px-2.5 md:py-1 md:text-xs">都有</span>
                    ) : (
                      spec.options?.map((opt: string, j: number) => (
                        <span key={j} className="inline-flex items-center rounded-md border border-border-soft bg-muted px-2 py-0.5 text-[10px] font-medium md:px-2.5 md:py-1 md:text-xs">{opt}</span>
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
              <h3 className="text-[13px] font-medium mb-1 md:text-base">說明</h3>
              <p className="text-[12px] text-muted-foreground whitespace-pre-wrap break-words leading-relaxed md:text-sm">{listing.note}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-1.5 md:gap-2">
            {listing.post_url && (
              <SafeExternalLink href={listing.post_url} className="flex-1 justify-center gap-1.5 h-10 rounded-lg text-[12px] font-semibold hover:opacity-85 active:scale-[0.98] md:h-12 md:rounded-xl md:text-sm md:gap-2" style={{ background: 'var(--brand-700)' }}>
                <ExternalLink className="h-3.5 w-3.5 md:h-4 md:w-4" /> 查看原始貼文
              </SafeExternalLink>
            )}
            <SharePopover title={listing.product?.name ?? listing.title ?? ''} />
            <ReportDialog
              listing_id={id}
              iconOnly
              triggerClassName="h-10 w-10 rounded-lg border-border-soft text-muted-foreground hover:bg-muted/50 active:scale-[0.96] transition-all cursor-pointer md:h-11 md:w-11 md:rounded-xl"
            />
          </div>

          {/* Seller info */}
          {listing.seller && (
            <div className="bg-background border border-border-soft rounded-lg p-3 flex items-center gap-2.5 md:rounded-2xl md:p-4 md:gap-3">
              <Link href={`/sellers/${listing.seller.id}`} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity flex-1 min-w-0 md:gap-3">
                <Avatar className="h-9 w-9 shrink-0 md:h-14 md:w-14">
                  <AvatarImage src={(listing.seller as any).avatar_url ?? undefined} />
                  <AvatarFallback className="font-semibold text-sm md:text-xl">{listing.seller.name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-foreground text-[13px] truncate md:text-lg">{listing.seller.name}</span>
                    {(listing.seller as any).is_social_verified && <SocialBadge className="h-3 w-3 text-primary shrink-0" />}
                  </div>
                  {formatLastSeen((listing.seller as any).profile?.last_seen_at) && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 md:text-xs">{formatLastSeen((listing.seller as any).profile?.last_seen_at)}</p>
                  )}
                </div>
              </Link>
              <div className="flex gap-1.5 shrink-0 md:flex-col">
                <Link
                  href={`/sellers/${listing.seller.id}`}
                  className="h-8 px-3 rounded-lg border border-border-soft bg-background text-[11px] font-medium text-text-muted flex items-center justify-center gap-1 hover:bg-muted/50 transition-colors md:h-10 md:px-6 md:text-sm md:min-w-[88px] md:gap-1.5"
                >
                  主頁 <ChevronRight className="h-3 w-3 md:h-3.5 md:w-3.5" />
                </Link>
                <Link
                  href={`/messages?seller_id=${listing.seller.id}&seller_name=${encodeURIComponent((listing.seller as any).profile?.display_name ?? listing.seller.name ?? '')}&seller_avatar=${encodeURIComponent((listing.seller as any).avatar_url ?? '')}&context_type=listing&context_id=${listing.id}&context_label=${encodeURIComponent(listing.title ?? listing.product?.name ?? '商品')}${images[0]?.url ? `&context_image=${encodeURIComponent(images[0].url)}` : ''}`}
                  className="h-8 px-3 rounded-lg border border-border-soft bg-background text-[11px] font-medium text-text-muted flex items-center justify-center gap-1 hover:bg-muted/50 transition-colors md:h-10 md:px-6 md:text-sm md:min-w-[88px] md:gap-1.5"
                >
                  詢問 <MessageSquare className="h-3 w-3 md:h-3.5 md:w-3.5" />
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
