'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  UserPlus, UserCheck, MapPin, Calendar,
  Star, Package, Globe, CheckCircle2, MessageCircle, ChevronLeft
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
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
import { ListingCard } from '@/components/listing/listing-card'
import { ConnectionCard } from '@/components/connection/connection-card'
import { EmptyState } from '@/components/shared/empty-state'
import { trpc } from '@/lib/trpc/client'
import { useSession } from '@/lib/context/session-context'
import { formatDate } from '@/lib/utils/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const LISTING_CATS = [
  { key: 'all', label: '全部' },
  { key: 'fashion', label: '服飾鞋款' },
  { key: 'beauty', label: '美妝' },
  { key: 'food', label: '食品' },
  { key: 'other', label: '其他' },
]


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

        {/* ── Hero ── */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:mt-6 md:gap-6 md:grid-cols-[1.4fr_1fr] md:gap-8 items-start">
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
                <p className="text-[14px] leading-[1.65] text-text-muted max-w-[520px] whitespace-pre-wrap">
                  {(seller as any).bio}
                </p>
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
                <button
                  onClick={() => followToggle.mutate({ seller_id: id })}
                  disabled={followToggle.isPending}
                  className={cn(
                    'h-11 w-[148px] rounded-[10px] text-[14px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors shrink-0',
                    seller.isFollowing
                      ? 'bg-surface-muted text-text-strong hover:bg-neutral-300'
                      : 'bg-text-strong text-white hover:bg-neutral-800'
                  )}
                >
                  {seller.isFollowing
                    ? <><UserCheck className="h-4 w-4" /> 已追蹤</>
                    : <><UserPlus className="h-4 w-4" /> 追蹤賣家</>}
                </button>
                <button
                  onClick={() => {
                    const name = seller.name ?? ''
                    const avatar = seller.avatar_url ?? (seller as any).profile?.avatar_url ?? ''
                    router.push(
                      `/messages?seller_id=${id}` +
                      `&seller_name=${encodeURIComponent(name)}` +
                      `&seller_avatar=${encodeURIComponent(avatar)}`
                    )
                  }}
                  className="h-11 w-11 rounded-[10px] bg-white text-text-muted border border-border-soft inline-flex items-center justify-center hover:bg-surface-muted transition-colors shrink-0"
                >
                  <MessageCircle className="h-4 w-4" />
                </button>
                <SharePopover
                  title={seller.name ?? ''}
                  triggerClassName="h-11 w-11 rounded-[10px] bg-white text-text-muted border border-border-soft inline-flex items-center justify-center hover:bg-surface-muted transition-colors cursor-pointer shrink-0"
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
                  <div className="w-[148px] shrink-0" />
                  <a
                    href={igHandle ? `https://www.instagram.com/${igHandle}` : `https://www.threads.net/@${threadsHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => recordSocialClick.mutate({ seller_id: id, platform: igHandle ? 'ig' : 'threads' })}
                    className="w-[148px] shrink-0 min-h-[64px] flex items-center gap-2.5 group border border-border-soft rounded-[14px] bg-white px-3 hover:bg-surface-muted transition-colors overflow-hidden"
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

        {/* ── Stats bar ── */}
        <div className="mt-4 mb-5 grid grid-cols-4 border border-border-soft rounded-lg overflow-hidden bg-white md:mt-7 md:mb-9 md:rounded-[14px]">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={cn(
                'px-1.5 py-2.5 sm:px-5 sm:py-[18px] flex flex-col gap-0.5 items-center text-center justify-center md:gap-1',
                i < stats.length - 1 && 'border-r border-border-soft'
              )}
            >
              <div className="text-[9px] font-medium text-text-muted uppercase tracking-[.04em] md:text-[11px]">{s.label}</div>
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
                {LISTING_CATS.map(c => (
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

            {listingItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-4">
                {listingItems.map((l: any) => (
                  <ListingCard key={l.id} listing={l} showBrand={false} showShippingDate={false} tallImage />
                ))}
              </div>
            ) : (
              <EmptyState icon={Package} title="尚無上架商品" />
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
              <EmptyState icon={Globe} title="尚無進行中的連線代購" />
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
                  !myReview && <EmptyState icon={Star} title="尚無評價" description="成為第一個留評價的人" />
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
