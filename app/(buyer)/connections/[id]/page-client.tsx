'use client'

import { use, useEffect } from 'react'
import Link from 'next/link'
import { MapPin, Truck, Check, MessageSquare, ChevronRight, Bookmark, Link2Off } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SocialBadge } from '@/components/seller/social-badge'
import { SafeExternalLink } from '@/components/shared/safe-external-link'
import { ConnectionDetailSkeleton } from '@/components/buyer/skeletons/connection-detail-skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { ImageGallery } from '@/components/shared/image-gallery'
import { trpc } from '@/lib/trpc/client'
import { formatDate, formatLastSeen } from '@/lib/utils/format'
import { PageBreadcrumb } from '@/components/shared/page-breadcrumb'
import { ReportDialog } from '@/components/shared/report-dialog'
import { SharePopover } from '@/components/shared/share-popover'
import { useSession } from '@/lib/context/session-context'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const DateTimeline = ({ start, end, startRaw, endRaw }: { start: string; end: string; startRaw: string | null; endRaw: string | null }) => {
  const days = startRaw && endRaw
    ? Math.round((new Date(endRaw).getTime() - new Date(startRaw).getTime()) / 86400000)
    : 0
  return (
    <div className="flex items-center py-0.5 md:py-1">
      <div className="flex-1 text-left">
        <div className="text-[8px] font-medium tracking-widest uppercase text-muted-foreground mb-0.5 md:text-[10px] md:mb-1">連線開始</div>
        <div className="text-[12px] font-semibold md:text-sm">{start}</div>
      </div>
      <div className="flex flex-col items-center gap-0.5 md:gap-1" style={{ flex: '0 0 60px' }}>
        {days > 0 && (
          <span className="text-[9px] font-medium text-muted-foreground md:text-[10px]">{days} 天</span>
        )}
        <div className="flex items-center w-full">
          <div className="w-1.5 h-1.5 rounded-full bg-foreground shrink-0 md:w-2 md:h-2" />
          <div className="flex-1 h-[1.5px]" style={{ background: 'repeating-linear-gradient(90deg, var(--border-strong) 0, var(--border-strong) 4px, transparent 4px, transparent 8px)' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-foreground shrink-0 md:w-2 md:h-2" />
        </div>
      </div>
      <div className="flex-1 text-right">
        <div className="text-[8px] font-medium tracking-widest uppercase text-muted-foreground mb-0.5 md:text-[10px] md:mb-1">連線結束</div>
        <div className="text-[12px] font-semibold md:text-sm">{end}</div>
      </div>
    </div>
  )
}

export default function ConnectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const session = useSession()
  const router = useRouter()
  const utils = trpc.useUtils()

  const { data: connection, isLoading } = trpc.connection.getById.useQuery({ id })

  const recordView = trpc.analytics.recordConnectionView.useMutation()
  useEffect(() => {
    if (!connection) return
    if (session?.user?.id === connection.seller_id) return
    const key = `cv_${id}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    recordView.mutate({ connection_id: id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection])

  const { data: bookmarkData } = trpc.bookmark.isConnectionBookmarked.useQuery(
    { connection_id: id },
    { enabled: !!session }
  )

  const toggleBookmark = trpc.bookmark.toggleConnectionBookmark.useMutation({
    onMutate: async () => {
      await utils.bookmark.isConnectionBookmarked.cancel({ connection_id: id })
      const prev = utils.bookmark.isConnectionBookmarked.getData({ connection_id: id })
      if (prev) {
        utils.bookmark.isConnectionBookmarked.setData({ connection_id: id }, { ...prev, bookmarked: !prev.bookmarked })
      }
      return { prev }
    },
    onError: (err, _vars, context) => {
      if (context?.prev) utils.bookmark.isConnectionBookmarked.setData({ connection_id: id }, context.prev)
      toast.error(err.message)
    },
    onSettled: () => utils.bookmark.isConnectionBookmarked.invalidate({ connection_id: id }),
  })

  const isBookmarked = bookmarkData?.bookmarked ?? false

  const handleBookmark = () => {
    if (!session) {
      router.push('/login')
      return
    }
    toggleBookmark.mutate({ connection_id: id })
  }

  if (isLoading) {
    return <ConnectionDetailSkeleton />
  }

  if (!connection) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-6">
        <EmptyState
          icon={Link2Off}
          title="找不到此連線"
          description="此頁面已失效"
        >
          <Link
            href="/connections"
            className="inline-flex h-10 items-center justify-center rounded-lg px-6 text-sm font-semibold text-white hover:opacity-85 active:scale-[0.98] transition-all"
            style={{ background: 'var(--brand-700)' }}
          >
            瀏覽其他連線
          </Link>
        </EmptyState>
      </div>
    )
  }

  const sortedImages = (connection.connection_images ?? []).slice().sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
  )
  const galleryImages = sortedImages.map((img: any) => ({
    url: img.url,
    alt: connection.title ?? '連線代購圖片',
  }))
  const seller = connection.seller as any
  const subRegion = connection.locations?.length ? connection.locations.join('・') : null

  return (
    <div className="mx-auto max-w-5xl px-3 py-3 md:px-6 md:py-6">
      <PageBreadcrumb items={[
        { label: '連線', href: '/connections' },
        { label: connection.title },
      ]} />

      <div className="grid gap-3 md:grid-cols-[1fr_1.15fr] md:gap-12 items-start">

        {/* Gallery — sticky on desktop */}
        <div className="md:sticky md:top-20 space-y-3">
          <ImageGallery
            images={galleryImages}
            title="連線代購圖片"
            emptyTitle="暫無圖片"
            emptyDescription="這則連線目前沒有上傳圖片"
          />
        </div>

        {/* Details */}
        <div className="flex flex-col gap-3 min-w-0 md:gap-7">

          {/* Header block */}
          <div className="flex items-start gap-2">
            <div className="flex flex-col gap-1 flex-1 min-w-0 md:gap-3">
              {connection.region && (
                <div className="flex items-center gap-1 flex-wrap text-[11px] font-medium text-muted-foreground md:text-sm md:gap-1.5">
                  <MapPin className="h-3 w-3 shrink-0 md:h-3.5 md:w-3.5" />
                  <span className="whitespace-nowrap text-foreground">{connection.region.name}</span>
                  {subRegion && (
                    <>
                      <span className="mx-0.5 text-muted-foreground/40 md:mx-1">·</span>
                      <span>{subRegion}</span>
                    </>
                  )}
                </div>
              )}

              {connection.title && (
                <h1 className="text-[15px] font-bold leading-snug md:text-xl">
                  {connection.can_wish && (
                    <span
                      className="inline-flex items-center gap-0.5 h-5 px-1.5 rounded text-[10px] font-semibold border mr-1.5 align-middle relative -top-px md:gap-1 md:h-6 md:px-2 md:rounded-md md:text-xs md:mr-2"
                      style={{ borderColor: 'var(--brand-500)', color: 'var(--brand-500)' }}
                    >
                      <Check className="h-2.5 w-2.5 md:h-3 md:w-3" /> 可許願
                    </span>
                  )}
                  {connection.title}
                </h1>
              )}
            </div>

            <button
              onClick={handleBookmark}
              disabled={toggleBookmark.isPending}
              className="shrink-0 self-start h-8 w-8 flex items-center justify-center rounded-full transition-all cursor-pointer disabled:opacity-60 hover:opacity-70 active:scale-[0.95] md:h-9 md:w-9"
              style={{ color: isBookmarked ? 'var(--brand-500)' : 'var(--text-faint)' }}
            >
              <Bookmark className="h-4 w-4 md:h-5 md:w-5" fill={isBookmarked ? 'currentColor' : 'none'} />
            </button>
          </div>

          {/* Date Timeline Card */}
          <div className="bg-background border border-border-soft rounded-lg px-3 py-2.5 md:rounded-2xl md:px-5 md:py-4">
            <DateTimeline
              start={formatDate(connection.start_date)}
              end={formatDate(connection.end_date)}
              startRaw={connection.start_date}
              endRaw={connection.end_date}
            />
            {connection.shipping_date && (
              <>
                <div className="h-px bg-border-soft my-2.5 md:my-4" />
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground md:text-sm md:gap-2.5">
                  <Truck className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" />
                  <span>預計 <strong className="text-foreground">{formatDate(connection.shipping_date)}</strong> 出貨</span>
                </div>
              </>
            )}
          </div>

          {/* Billing Method */}
          {connection.billing_method && (
            <div
              className="rounded-lg p-3 md:rounded-2xl md:p-5"
              style={{ background: 'var(--brand-50)' }}
            >
              <div
                className="text-[9px] font-semibold tracking-widest uppercase mb-1 md:text-[11px] md:mb-2"
                style={{ color: 'var(--brand-900)' }}
              >
                計費方式
              </div>
              <p className="text-[12px] font-medium leading-relaxed whitespace-pre-wrap md:text-sm" style={{ color: 'var(--brand-700)' }}>
                {connection.billing_method}
              </p>
            </div>
          )}

          {/* Description */}
          {connection.description && (
            <section>
              <h2 className="font-heading text-[13px] font-semibold mb-1.5 md:text-base md:mb-2.5">連線說明</h2>
              <p className="text-[12px] text-muted-foreground whitespace-pre-wrap break-words leading-relaxed md:text-sm">
                {connection.description}
              </p>
            </section>
          )}

          {/* CTAs */}
          <div className="flex gap-1.5 md:gap-2">
            {connection.post_link && (
              <SafeExternalLink href={connection.post_link} className="flex-1 justify-center gap-1.5 h-10 rounded-lg text-[12px] font-semibold hover:opacity-85 active:scale-[0.98] md:h-12 md:rounded-xl md:text-sm md:gap-2" style={{ background: 'var(--brand-700)' }}>
                <MessageSquare className="h-3.5 w-3.5 md:h-4 md:w-4" /> 查看貼文 / 群組
              </SafeExternalLink>
            )}
            <SharePopover title={connection.title ?? ''} />
            <ReportDialog
              connection_id={id}
              iconOnly
              triggerClassName="h-10 w-10 rounded-lg border-border-soft text-muted-foreground hover:bg-muted/50 active:scale-[0.96] transition-all cursor-pointer md:h-11 md:w-11 md:rounded-xl"
            />
          </div>

          {/* Seller Card */}
          {seller && (
            <div className="bg-background border border-border-soft rounded-lg p-3 flex items-center gap-2.5 md:rounded-2xl md:p-4 md:gap-3">
              <Link href={`/sellers/${seller.id}`} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity flex-1 min-w-0 md:gap-3">
                <Avatar className="h-9 w-9 shrink-0 md:h-14 md:w-14">
                  <AvatarImage src={seller.avatar_url ?? seller.profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="font-semibold text-sm md:text-xl">{seller.name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-foreground text-[13px] truncate md:text-lg">{seller.name}</span>
                    {seller.is_social_verified && <SocialBadge className="h-3 w-3 text-primary shrink-0" />}
                  </div>
                  {formatLastSeen(seller.profile?.last_seen_at) && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 md:text-xs">{formatLastSeen(seller.profile?.last_seen_at)}</p>
                  )}
                </div>
              </Link>
              <div className="flex gap-1.5 shrink-0 md:flex-col">
                <Link
                  href={`/sellers/${seller.id}`}
                  className="h-8 px-3 rounded-lg border border-border-soft bg-background text-[11px] font-medium text-text-muted flex items-center justify-center gap-1 hover:bg-muted/50 transition-colors md:h-10 md:px-6 md:text-sm md:min-w-[88px] md:gap-1.5"
                >
                  主頁 <ChevronRight className="h-3 w-3 md:h-3.5 md:w-3.5" />
                </Link>
                <Link
                  href={`/messages?seller_id=${seller.id}&seller_name=${encodeURIComponent(seller.name ?? '')}&seller_avatar=${encodeURIComponent(seller.avatar_url ?? seller.profile?.avatar_url ?? '')}&context_type=connection&context_id=${id}&context_label=${encodeURIComponent(connection.title ?? '連線代購')}${sortedImages[0]?.url ? `&context_image=${encodeURIComponent(sortedImages[0].url)}` : ''}`}
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
