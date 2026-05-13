'use client'

import { use } from 'react'
import Link from 'next/link'
import { MapPin, Truck, Check, MessageSquare, ChevronRight, Bookmark } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { SafeExternalLink } from '@/components/shared/safe-external-link'
import { ImageGallery } from '@/components/shared/image-gallery'
import { trpc } from '@/lib/trpc/client'
import { formatDate } from '@/lib/utils/format'
import { PageBreadcrumb } from '@/components/shared/page-breadcrumb'
import { ReportDialog } from '@/components/shared/report-dialog'
import { SharePopover } from '@/components/shared/share-popover'
import { useSession } from '@/lib/context/session-context'
import { useRouter } from 'next/navigation'

const DateTimeline = ({ start, end, startRaw, endRaw }: { start: string; end: string; startRaw: string; endRaw: string }) => {
  const days = Math.round((new Date(endRaw).getTime() - new Date(startRaw).getTime()) / 86400000)
  return (
    <div className="flex items-center py-1">
      <div className="flex-1 text-left">
        <div className="text-[10px] font-medium tracking-widest uppercase text-muted-foreground mb-1">連線開始</div>
        <div className="text-sm font-semibold">{start}</div>
      </div>
      <div className="flex flex-col items-center gap-1" style={{ flex: '0 0 80px' }}>
        {days > 0 && (
          <span className="text-[10px] font-medium text-muted-foreground">{days} 天</span>
        )}
        <div className="flex items-center w-full">
          <div className="w-2 h-2 rounded-full bg-foreground shrink-0" />
          <div className="flex-1 h-[1.5px]" style={{ background: 'repeating-linear-gradient(90deg, #ccc 0, #ccc 4px, transparent 4px, transparent 8px)' }} />
          <div className="w-2 h-2 rounded-full bg-foreground shrink-0" />
        </div>
      </div>
      <div className="flex-1 text-right">
        <div className="text-[10px] font-medium tracking-widest uppercase text-muted-foreground mb-1">連線結束</div>
        <div className="text-sm font-semibold">{end}</div>
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

  const { data: bookmarkData } = trpc.bookmark.isConnectionBookmarked.useQuery(
    { connection_id: id },
    { enabled: !!session }
  )

  const toggleBookmark = trpc.bookmark.toggleConnectionBookmark.useMutation({
    onSuccess: () => utils.bookmark.isConnectionBookmarked.invalidate({ connection_id: id }),
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
    return (
      <div className="mx-auto max-w-5xl px-6 py-6 space-y-6">
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-8 w-64" />
      </div>
    )
  }

  if (!connection) return null

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
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageBreadcrumb items={[
        { label: '連線', href: '/connections' },
        { label: connection.title },
      ]} />

      <div className="grid gap-12 md:grid-cols-[1fr_1.15fr] items-start">

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
        <div className="flex flex-col gap-7 min-w-0">

          {/* Header block */}
          <div className="flex items-start gap-3">
            <div className="flex flex-col gap-3 flex-1 min-w-0">
              {/* Location chip */}
              {connection.region && (
                <div className="flex items-center gap-1.5 flex-wrap text-sm font-medium text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="whitespace-nowrap text-foreground">{connection.region.name}</span>
                  {subRegion && (
                    <>
                      <span className="mx-1 text-muted-foreground/40">·</span>
                      <span>{subRegion}</span>
                    </>
                  )}
                </div>
              )}

              {/* Title */}
              {connection.title && (
                <h1 className="text-xl font-bold leading-snug">
                  {connection.title}
                </h1>
              )}

              {/* Status badges */}
              {connection.can_wish && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-semibold border"
                    style={{ borderColor: '#4ab0a9', color: '#4ab0a9' }}
                  >
                    <Check className="h-3 w-3" /> 開放許願
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={handleBookmark}
              disabled={toggleBookmark.isPending}
              className="shrink-0 self-start -mt-1 h-9 w-9 flex items-center justify-center rounded-full transition-all cursor-pointer disabled:opacity-60 hover:opacity-70 active:scale-[0.95]"
              style={{ color: isBookmarked ? '#4ab0a9' : '#aaa' }}
            >
              <Bookmark className="h-5 w-5" fill={isBookmarked ? 'currentColor' : 'none'} />
            </button>
          </div>

          {/* Date Timeline Card */}
          <div className="bg-background border border-[#ececec] rounded-2xl px-5 py-4">
            <DateTimeline
              start={formatDate(connection.start_date)}
              end={formatDate(connection.end_date)}
              startRaw={connection.start_date}
              endRaw={connection.end_date}
            />
            {connection.shipping_date && (
              <>
                <div className="h-px bg-[#f0f0f0] my-4" />
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Truck className="h-4 w-4 shrink-0" />
                  <span>預計 <strong className="text-foreground">{formatDate(connection.shipping_date)}</strong> 出貨</span>
                </div>
              </>
            )}
          </div>

          {/* Billing Method — prominent warm card */}
          {connection.billing_method && (
            <div
              className="rounded-2xl p-5"
              style={{ background: '#f4fbfe' }}
            >
              <div
                className="text-[11px] font-semibold tracking-widest uppercase mb-2"
                style={{ color: '#168eb4' }}
              >
                計費方式
              </div>
              <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap" style={{ color: '#1a9ac4' }}>
                {connection.billing_method}
              </p>
            </div>
          )}

          {/* Description */}
          {connection.description && (
            <section>
              <h2 className="font-heading text-base font-semibold mb-2.5">連線說明</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
                {connection.description}
              </p>
            </section>
          )}

          {/* CTAs */}
          <div className="flex gap-2">
            {connection.post_link && (
              <SafeExternalLink href={connection.post_link} className="flex-1 justify-center gap-2 h-12 rounded-xl text-sm font-semibold hover:opacity-85 active:scale-[0.98]" style={{ background: '#1a9ac4' }}>
                <MessageSquare className="h-4 w-4" /> 查看貼文 / 群組
              </SafeExternalLink>
            )}
            <SharePopover title={connection.title ?? ''} />
            <ReportDialog
              connection_id={id}
              iconOnly
              triggerClassName="h-11 w-11 rounded-xl border-[#e2e2e2] text-muted-foreground hover:bg-muted/50 active:scale-[0.96] transition-all cursor-pointer"
            />
          </div>

          {/* Seller Card */}
          {seller && (
            <div className="bg-background border border-[#ececec] rounded-2xl p-4 flex items-center gap-3">
              <Link href={`/sellers/${seller.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-1 min-w-0">
                <Avatar className="h-14 w-14 shrink-0">
                  <AvatarImage src={seller.avatar_url ?? seller.profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="font-semibold text-xl">{seller.name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <span className="font-semibold text-foreground text-lg truncate block">{seller.name}</span>
                  {seller.profile?.username && (
                    <p className="text-sm text-muted-foreground mt-0.5">@{seller.profile.username}</p>
                  )}
                </div>
              </Link>
              <div className="flex flex-col gap-1.5 shrink-0">
                <Link
                  href={`/sellers/${seller.id}`}
                  className="h-10 px-6 min-w-[88px] rounded-lg border border-[#e2e2e2] bg-background text-sm font-medium text-[#444] flex items-center justify-center gap-1.5 hover:bg-muted/50 transition-colors"
                >
                  主頁 <ChevronRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href={`/messages?seller_id=${seller.id}&seller_name=${encodeURIComponent(seller.name ?? '')}&seller_avatar=${encodeURIComponent(seller.avatar_url ?? seller.profile?.avatar_url ?? '')}&context_type=connection&context_id=${id}&context_label=${encodeURIComponent(connection.title ?? '連線代購')}${sortedImages[0]?.url ? `&context_image=${encodeURIComponent(sortedImages[0].url)}` : ''}`}
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
