'use client'

import { use, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  UserPlus, UserCheck, MapPin, Calendar,
  Star, CheckCircle2, MessageCircle, ChevronLeft
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { FilterTabsList } from '@/components/shared/filter-tabs-list'
import { Skeleton } from '@/components/ui/skeleton'
import { SellerProfileSkeleton } from '@/components/buyer/skeletons/seller-profile-skeleton'
import { StarRating } from '@/components/shared/star-rating'
import { SocialBadge } from '@/components/seller/social-badge'
import { ReportDialog } from '@/components/shared/report-dialog'
import { SharePopover } from '@/components/shared/share-popover'
import { ReviewComposer } from '@/components/review/review-composer'
import { ReviewList } from '@/components/review/review-list'
import { ListingResultCard } from '@/components/listing/listing-result-card'
import { ConnectionCard } from '@/components/connection/connection-card'
import { EmptyState } from '@/components/shared/empty-state'
import { trpc } from '@/lib/trpc/client'
import { useSession } from '@/lib/context/session-context'
import { formatDate, PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

function StarRow({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex gap-px">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={i <= Math.round(value) ? 'fill-amber-400 stroke-amber-400' : 'fill-none stroke-neutral-300'}
          strokeWidth={1.5}
        />
      ))}
    </div>
  )
}

function ExpandableBio({ text, className }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const ref = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => {
      if (expanded) return
      setOverflowing(el.scrollHeight > el.clientHeight + 1)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [text, expanded])

  return (
    <div className={className}>
      <p
        ref={ref}
        className={cn(
          'text-[13.5px] leading-[1.6] text-text-muted whitespace-pre-wrap md:text-[14px] md:leading-[1.65]',
          !expanded && 'line-clamp-5'
        )}
      >
        {text}
      </p>
      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 inline-block text-[13px] font-medium text-brand-700 hover:text-brand-500 transition-colors cursor-pointer"
        >
          {expanded ? '收合' : '展開'}
        </button>
      )}
    </div>
  )
}

export default function SellerPageClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const session = useSession()
  const utils = trpc.useUtils()
  const isOwnProfile = session?.user?.id === id
  const [listingCat, setListingCat] = useState('all')
  const [listingSort, setListingSort] = useState('latest')

  const currentUserId = session?.user?.id

  const { data: seller, isLoading } = trpc.seller.getById.useQuery({ id })
  const { data: listings } = trpc.seller.getListings.useQuery({ sellerId: id })
  const { data: connections } = trpc.connection.getBySeller.useQuery({ sellerId: id })

  const {
    data: reviewPages,
    isLoading: isLoadingReviews,
    fetchNextPage: fetchMoreReviews,
    hasNextPage: hasMoreReviews,
    isFetchingNextPage: isFetchingMoreReviews,
  } = trpc.review.getBySeller.useInfiniteQuery(
    { seller_id: id, limit: 20 },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  )
  const { data: ratingDistribution } = trpc.review.getDistribution.useQuery({ seller_id: id })
  const { data: myReview } = trpc.review.getMyReviewForSeller.useQuery(
    { seller_id: id },
    { enabled: !!currentUserId && !isOwnProfile }
  )

  const followToggle = trpc.follow.toggle.useMutation({
    onMutate: async () => {
      await utils.seller.getById.cancel({ id })
      const prev = utils.seller.getById.getData({ id })
      if (prev) {
        utils.seller.getById.setData({ id }, {
          ...prev,
          isFollowing: !prev.isFollowing,
          follow_count: prev.follow_count + (prev.isFollowing ? -1 : 1),
        })
      }
      return { prev }
    },
    onError: (err, _vars, context) => {
      if (context?.prev) utils.seller.getById.setData({ id }, context.prev)
      toast.error(err.message)
    },
    onSettled: () => utils.seller.getById.invalidate({ id }),
  })

  const recordProfileView = trpc.analytics.recordProfileView.useMutation()
  const recordSocialClick = trpc.analytics.recordSocialClick.useMutation()

  useEffect(() => {
    if (!seller) return
    // 不記錄賣家自己瀏覽
    if (isOwnProfile) return
    const key = `pv_${id}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    recordProfileView.mutate({ seller_id: id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seller])

  if (isLoading) {
    return <SellerProfileSkeleton />
  }

  if (!seller) return null

  // 列表顯示用：攤平所有已載入分頁，並濾掉自己的評價（自己的顯示在上方撰寫區）
  const reviewItems = (reviewPages?.pages.flatMap((p) => p.items) ?? [])
    .filter((r) => r.id !== myReview?.id)

  // 星等分佈：用全站統計（涵蓋所有評價，而非目前載入的單頁）
  const ratingDist = [5, 4, 3, 2, 1].map(stars => ({
    stars,
    count: ratingDistribution?.find((d) => d.stars === stars)?.count ?? 0,
  }))
  const ratingTotal = ratingDist.reduce((a, b) => a + b.count, 0)

  const listingItems = listings?.items ?? []

  // 分類晶片：依這個賣家實際上架過的商品分類動態產生（用系統 20 分類標籤）
  const listingCats = [
    { key: 'all', label: '全部' },
    ...Array.from(new Set(listingItems.map((l: any) => l.product?.category).filter(Boolean)))
      .map((key) => ({ key: key as string, label: PRODUCT_CATEGORY_LABELS[key as string] ?? (key as string) })),
  ]

  // 套用分類篩選 + 排序（後端只回最新排序，價格排序在前端處理）
  const visibleListings = listingItems
    .filter((l: any) => listingCat === 'all' || l.product?.category === listingCat)
    .sort((a: any, b: any) => {
      if (listingSort === 'price-asc' || listingSort === 'price-desc') {
        // 來訊問價（price 為 null）一律排在最後，不分升冪降冪
        const an = a.price == null
        const bn = b.price == null
        if (an && bn) return 0
        if (an) return 1
        if (bn) return -1
        return listingSort === 'price-asc' ? a.price - b.price : b.price - a.price
      }
      // latest：建立時間新→舊
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    })


  const igHandle = seller.ig_handle
  const threadsHandle = (seller as any).threads_handle as string | null | undefined
  const hasSocial = !!(igHandle || threadsHandle)

  const stats = [
    { label: '代購商品', value: listingItems.length > 0 ? listingItems.length : (seller as any).listing_count ?? '-' },
    { label: '連線代購', value: connections?.length ?? '-' },
    { label: '平均評價', value: seller.avg_rating != null ? seller.avg_rating.toFixed(1) : '-', star: true, sub: seller.review_count ? `${seller.review_count} 則評價` : undefined },
    { label: '追蹤者', value: seller.follow_count.toLocaleString() },
  ]

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-4xl px-3 pb-12 pt-3 md:px-4 md:pb-20 md:pt-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-[13px] text-text-muted hover:text-text-strong transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
          返回
        </button>

        {/* ── Mobile hero（置中型，手機專用） ── */}
        <div className="md:hidden mt-4 mb-5 flex flex-col items-center text-center">
          <Avatar className="h-20 w-20">
            <AvatarImage src={seller.avatar_url ?? (seller as any).profile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-2xl font-semibold bg-gradient-to-br from-[#2d3a5e] to-[#0f1a36] text-white">
              {seller.name[0]}
            </AvatarFallback>
          </Avatar>

          <div className="mt-3 flex items-center justify-center gap-1.5">
            <h1 className="text-xl font-bold tracking-tight leading-none" style={{ fontFamily: 'Rubik, "Noto Sans TC", sans-serif' }}>
              {seller.name}
            </h1>
            {seller.is_social_verified && <SocialBadge />}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[12px] text-text-faint">
            {seller.seller_regions && seller.seller_regions.length > 0 && (
              <>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {seller.seller_regions.map((r: any) => r.region?.name).filter(Boolean).join('、')}
                </span>
                <span>·</span>
              </>
            )}
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              加入於 {formatDate(seller.created_at)}
            </span>
          </div>

          {/* Stats strip */}
          <div className="mt-4 w-full grid grid-cols-4 border border-border-soft rounded-[14px] overflow-hidden bg-white">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={cn(
                  'px-1 py-2.5 flex flex-col items-center justify-center gap-0.5',
                  i < stats.length - 1 && 'border-r border-border-soft'
                )}
              >
                <div
                  className="flex items-baseline gap-0.5"
                  style={{ fontFamily: 'Rubik, sans-serif', fontSize: 'clamp(16px, 4.5vw, 20px)', fontWeight: 700, color: 'var(--text-strong)', letterSpacing: '-0.01em' }}
                >
                  {s.value}
                  {s.star && s.value !== '-' && <Star className="h-3 w-3 fill-amber-400 stroke-amber-400 mb-0.5" strokeWidth={1.5} />}
                </div>
                <div className="text-[11px] text-text-muted">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Bio */}
          {(seller as any).bio && (
            <ExpandableBio text={(seller as any).bio} className="mt-4 w-full text-center" />
          )}

          {/* Actions */}
          {!isOwnProfile && (
            <div className="mt-4 w-full flex gap-2">
              <Button
                size="xl"
                variant={seller.isFollowing ? 'outline-soft' : 'default'}
                onClick={() => followToggle.mutate({ seller_id: id })}
                disabled={followToggle.isPending}
                className="flex-1 rounded-[10px] font-semibold"
              >
                {seller.isFollowing
                  ? <><UserCheck className="h-4 w-4" /> 已追蹤</>
                  : <><UserPlus className="h-4 w-4" /> 追蹤賣家</>}
              </Button>
              <Button
                variant="outline"
                size="icon-xl"
                onClick={() => {
                  const name = seller.name ?? ''
                  const avatar = seller.avatar_url ?? (seller as any).profile?.avatar_url ?? ''
                  router.push(`/messages?seller_id=${id}&seller_name=${encodeURIComponent(name)}&seller_avatar=${encodeURIComponent(avatar)}`)
                }}
                className="rounded-[10px] text-text-muted shrink-0"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
              <SharePopover
                title={seller.name ?? ''}
                triggerClassName={cn(buttonVariants({ variant: 'outline', size: 'icon-xl' }), 'rounded-[10px] text-text-muted shrink-0')}
              />
              <ReportDialog seller_id={id} iconOnly />
            </div>
          )}

          {/* Social */}
          {hasSocial && (
            <div className="mt-2 w-full flex gap-2">
              {igHandle && (
                <a
                  href={`https://www.instagram.com/${igHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => recordSocialClick.mutate({ seller_id: id, platform: 'ig' })}
                  className="flex-1 min-w-0 min-h-[52px] flex items-center gap-2.5 border border-border-soft rounded-[14px] bg-white px-3"
                >
                  <Image src="/images/instagram.png" alt="Instagram" width={24} height={24} className="rounded-[5px] shrink-0" />
                  <span className="text-[13.5px] font-semibold text-text-strong truncate">{igHandle}</span>
                </a>
              )}
              {threadsHandle && (
                <a
                  href={`https://www.threads.net/@${threadsHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => recordSocialClick.mutate({ seller_id: id, platform: 'threads' })}
                  className="flex-1 min-w-0 min-h-[52px] flex items-center gap-2.5 border border-border-soft rounded-[14px] bg-white px-3"
                >
                  <Image src="/images/threads.png" alt="Threads" width={24} height={24} className="rounded-[5px] shrink-0" />
                  <span className="text-[13.5px] font-semibold text-text-strong truncate">{threadsHandle}</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── Hero（桌機版） ── */}
        <div className="hidden md:grid mt-4 gap-4 md:mt-6 md:gap-6 md:grid-cols-[1.4fr_1fr] md:gap-8 items-start">
          {/* Left: avatar + info */}
          <div className="flex gap-3 md:gap-6">
            <Avatar className="h-16 w-16 shrink-0 md:h-[104px] md:w-[104px]">
              <AvatarImage src={seller.avatar_url ?? (seller as any).profile?.avatar_url ?? undefined} />
              <AvatarFallback className="text-xl font-semibold bg-gradient-to-br from-[#2d3a5e] to-[#0f1a36] text-white md:text-3xl">
                {seller.name[0]}
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col gap-2 pt-0.5 min-w-0 md:gap-3 md:pt-1">
              {/* Name + badge + date */}
              <div>
                <div className="flex items-center gap-1.5 mb-1 flex-wrap md:gap-2 md:mb-1.5">
                  <h1 className="text-xl font-bold tracking-tight leading-none md:text-[28px]" style={{ fontFamily: 'Rubik, "Noto Sans TC", sans-serif' }}>
                    {seller.name}
                  </h1>
                  {seller.is_social_verified && <SocialBadge />}
                  <span className="inline-flex items-center gap-1 text-[12px] text-text-faint font-normal ml-0.5">
                    <Calendar className="h-3 w-3" />
                    加入於 {formatDate(seller.created_at)}
                  </span>
                </div>

                {/* Region chips */}
                {seller.seller_regions && seller.seller_regions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {seller.seller_regions.map((r: any) => (
                      <span
                        key={r.region?.id}
                        className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12.5px] font-medium bg-surface-muted text-text-muted"
                      >
                        <MapPin className="h-3 w-3" />
                        {r.region?.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bio */}
              {(seller as any).bio && (
                <ExpandableBio text={(seller as any).bio} className="max-w-[520px]" />
              )}

              {/* Rating (mobile fallback if no stats bar) */}
              {seller.avg_rating != null && (
                <div className="flex items-center gap-2 md:hidden">
                  <StarRow value={seller.avg_rating} />
                  <span className="text-[12.5px] text-text-muted">{seller.avg_rating.toFixed(1)} ({seller.review_count} 則評價)</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: actions + social card */}
          <div className="flex flex-col gap-2 w-full md:w-fit md:ml-auto">
            {/* Button row: 追蹤(148px) + 訊息+分享+檢舉(148px) */}
            {!isOwnProfile && (
              <div className="flex gap-2">
                <Button
                  size="xl"
                  variant={seller.isFollowing ? 'outline-soft' : 'default'}
                  onClick={() => followToggle.mutate({ seller_id: id })}
                  disabled={followToggle.isPending}
                  className="w-[148px] rounded-[10px] font-semibold"
                >
                  {seller.isFollowing
                    ? <><UserCheck className="h-4 w-4" /> 已追蹤</>
                    : <><UserPlus className="h-4 w-4" /> 追蹤賣家</>}
                </Button>
                <Button
                  variant="outline"
                  size="icon-xl"
                  onClick={() => {
                    const name = seller.name ?? ''
                    const avatar = seller.avatar_url ?? (seller as any).profile?.avatar_url ?? ''
                    router.push(
                      `/messages?seller_id=${id}` +
                      `&seller_name=${encodeURIComponent(name)}` +
                      `&seller_avatar=${encodeURIComponent(avatar)}`
                    )
                  }}
                  className="rounded-[10px] text-text-muted shrink-0"
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
                <SharePopover
                  title={seller.name ?? ''}
                  triggerClassName={cn(buttonVariants({ variant: 'outline', size: 'icon-xl' }), 'rounded-[10px] text-text-muted shrink-0')}
                />
                <ReportDialog seller_id={id} iconOnly />
              </div>
            )}

            {/* Social card(s) */}
            {hasSocial && <div className="flex gap-2">
              {igHandle && threadsHandle ? (
                <>
                  <a
                    href={`https://www.instagram.com/${igHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => recordSocialClick.mutate({ seller_id: id, platform: 'ig' })}
                    className="flex-1 min-w-0 min-h-[64px] flex items-center gap-2.5 group border border-border-soft rounded-[14px] bg-white px-3 hover:bg-surface-muted transition-colors"
                  >
                    <Image src="/images/instagram.png" alt="Instagram" width={24} height={24} className="rounded-[5px] shrink-0" />
                    <span className="text-[13.5px] font-semibold text-text-strong group-hover:text-text-muted leading-tight break-all">{igHandle}</span>
                  </a>
                  <a
                    href={`https://www.threads.net/@${threadsHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => recordSocialClick.mutate({ seller_id: id, platform: 'threads' })}
                    className="flex-1 min-w-0 min-h-[64px] flex items-center gap-2.5 group border border-border-soft rounded-[14px] bg-white px-3 hover:bg-surface-muted transition-colors"
                  >
                    <Image src="/images/threads.png" alt="Threads" width={24} height={24} className="rounded-[5px] shrink-0" />
                    <span className="text-[13.5px] font-semibold text-text-strong group-hover:text-text-muted leading-tight break-all">{threadsHandle}</span>
                  </a>
                </>
              ) : (
                <>
                  <div className="hidden md:block md:w-[148px] shrink-0" />
                  <a
                    href={igHandle ? `https://www.instagram.com/${igHandle}` : `https://www.threads.net/@${threadsHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => recordSocialClick.mutate({ seller_id: id, platform: igHandle ? 'ig' : 'threads' })}
                    className="flex-1 md:w-[148px] md:flex-none min-h-[64px] flex items-center gap-2.5 group border border-border-soft rounded-[14px] bg-white px-3 hover:bg-surface-muted transition-colors overflow-hidden"
                  >
                    <Image
                      src={igHandle ? '/images/instagram.png' : '/images/threads.png'}
                      alt={igHandle ? 'Instagram' : 'Threads'}
                      width={24} height={24} className="rounded-[5px] shrink-0"
                    />
                    <span className="text-[13.5px] font-semibold text-text-strong group-hover:text-text-muted leading-tight break-all">{igHandle ?? threadsHandle}</span>
                  </a>
                </>
              )}
            </div>}
          </div>
        </div>

        {/* ── Stats bar（桌機版；手機在上方置中 hero 內） ── */}
        <div className="hidden md:grid grid-cols-4 border border-border-soft rounded-lg overflow-hidden bg-white md:mt-7 md:mb-9 md:rounded-[14px]">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={cn(
                'px-1.5 py-2.5 sm:px-5 sm:py-[18px] flex flex-col gap-0.5 items-center text-center justify-center md:gap-1',
                i < stats.length - 1 && 'border-r border-border-soft'
              )}
            >
              <div className="text-[11px] font-medium text-text-muted uppercase tracking-[.04em]">{s.label}</div>
              <div className="flex items-baseline gap-1" style={{ fontFamily: 'Rubik, sans-serif', fontSize: 'clamp(16px, 4vw, 24px)', fontWeight: 700, color: 'var(--text-strong)', letterSpacing: '-0.01em' }}>
                {s.value}
                {s.star && s.value !== '-' && <Star className="h-3.5 w-3.5 fill-amber-400 stroke-amber-400 mb-0.5" strokeWidth={1.5} />}
              </div>
              {s.sub && <div className="text-[11.5px] text-text-faint">{s.sub}</div>}
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="listings">
          <FilterTabsList items={[
            { value: 'listings', label: '代購商品' },
            { value: 'connections', label: '連線代購' },
            { value: 'reviews', label: '評價' },
          ]} />

          {/* ── Products tab ── */}
          <TabsContent value="listings" className="mt-5">
            <div className="flex items-center gap-2 mb-3 flex-wrap md:gap-3 md:mb-5">
              <div className="flex gap-0.5 p-[2px] bg-surface-muted rounded-full md:gap-1 md:p-[3px]">
                {listingCats.map(c => (
                  <button
                    key={c.key}
                    onClick={() => setListingCat(c.key)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors md:px-3.5 md:py-1.5 md:text-[12.5px]',
                      listingCat === c.key
                        ? 'bg-white text-text-strong shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                        : 'text-text-muted hover:text-text-muted'
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-1.5 text-[10px] text-text-muted md:gap-2 md:text-[12.5px]">
                <span>排序</span>
                <select
                  value={listingSort}
                  onChange={e => setListingSort(e.target.value)}
                  className="h-7 border border-border-soft rounded-lg px-2 text-[10px] bg-white cursor-pointer outline-none md:h-8 md:px-2.5 md:text-[12.5px]"
                >
                  <option value="latest">最新上架</option>
                  <option value="price-asc">價格 低 → 高</option>
                  <option value="price-desc">價格 高 → 低</option>
                </select>
              </div>
            </div>

            {visibleListings.length > 0 ? (
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-4">
                {visibleListings.map((l: any) => (
                  <ListingResultCard key={l.id} listing={l} showSeller={false} />
                ))}
              </div>
            ) : (
              <EmptyState icon="product" title="尚無上架商品" />
            )}
          </TabsContent>

          {/* ── Connections tab ── */}
          <TabsContent value="connections" className="mt-5">
            {connections && connections.length > 0 ? (
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-4">
                {connections.map((c: any) => (
                  <ConnectionCard key={c.id} connection={c} />
                ))}
              </div>
            ) : (
              <EmptyState icon="connection" title="尚無進行中的連線代購" />
            )}
          </TabsContent>

          {/* ── Reviews tab ── */}
          <TabsContent value="reviews" className="mt-5">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-[300px_1fr] md:gap-9">
              {/* Rating sidebar */}
              <aside className="bg-surface-muted border border-border-soft rounded-[14px] p-[22px] h-fit">
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span style={{ fontFamily: 'Rubik, sans-serif', fontSize: 44, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-strong)' }}>
                    {seller.avg_rating?.toFixed(1) ?? '-'}
                  </span>
                  <span className="text-[14px] text-text-muted">/ 5</span>
                </div>
                {seller.avg_rating != null && <StarRow value={seller.avg_rating} size={16} />}
                <div className="text-[12.5px] text-text-muted mt-1.5">共 {seller.review_count ?? 0} 則評價</div>
                <div className="mt-4 flex flex-col gap-2">
                  {ratingDist.map(r => {
                    const pct = ratingTotal ? (r.count / ratingTotal) * 100 : 0
                    return (
                      <div key={r.stars} className="grid items-center gap-2.5 text-[12px]" style={{ gridTemplateColumns: '36px 1fr 28px' }}>
                        <span className="inline-flex items-center gap-1 text-text-muted">
                          {r.stars} <Star className="h-2.5 w-2.5 fill-amber-400 stroke-amber-400" strokeWidth={1.5} />
                        </span>
                        <div className="h-1.5 bg-border-soft rounded-full overflow-hidden">
                          <div
                            className="h-full bg-text-strong rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-text-muted text-right">{r.count}</span>
                      </div>
                    )
                  })}
                </div>
              </aside>

              {/* Review list */}
              <div className="flex flex-col gap-4">
                <ReviewComposer
                  sellerId={id}
                  isOwnProfile={isOwnProfile}
                  isLoggedIn={!!currentUserId}
                  myReview={myReview ?? null}
                />
                {isLoadingReviews ? (
                  <div className="flex flex-col gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-28 w-full rounded-[14px]" />
                    ))}
                  </div>
                ) : reviewItems.length > 0 ? (
                  <>
                    <ReviewList reviews={reviewItems} sellerId={id} canReply={isOwnProfile} />
                    {hasMoreReviews && (
                      <div className="pt-1 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchMoreReviews()}
                          disabled={isFetchingMoreReviews}
                        >
                          {isFetchingMoreReviews ? '載入中...' : '載入更多評價'}
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  !myReview && <EmptyState icon="review" title="尚無評價" description="成為第一個留評價的人" />
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
