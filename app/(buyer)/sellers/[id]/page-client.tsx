'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  UserPlus, UserCheck, MapPin, Calendar,
  Star, Package, Globe, CheckCircle2, MessageCircle, ChevronLeft
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { FilterTabsList } from '@/components/shared/filter-tabs-list'
import { Skeleton } from '@/components/ui/skeleton'
import { StarRating } from '@/components/shared/star-rating'
import { SocialBadge } from '@/components/seller/social-badge'
import { ReportDialog } from '@/components/shared/report-dialog'
import { SharePopover } from '@/components/shared/share-popover'
import { ReviewForm } from '@/components/review/review-form'
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
          className={i <= Math.round(value) ? 'fill-text-strong stroke-text-strong' : 'fill-none stroke-text-strong'}
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

  const { data: seller, isLoading } = trpc.seller.getById.useQuery({ id })
  const { data: listings } = trpc.seller.getListings.useQuery({ sellerId: id })
  const { data: connections } = trpc.connection.getBySeller.useQuery({ sellerId: id })
  const { data: reviews } = trpc.review.getBySeller.useQuery({ seller_id: id })

  const followToggle = trpc.follow.toggle.useMutation({
    onSuccess: () => utils.seller.getById.invalidate({ id }),
    onError: (err) => toast.error(err.message),
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
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        <Skeleton className="h-5 w-48 rounded" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    )
  }

  if (!seller) return null

  // Rating distribution computed from loaded reviews
  const reviewItems = reviews?.items ?? []
  const ratingDist = [5, 4, 3, 2, 1].map(stars => ({
    stars,
    count: reviewItems.filter((r: any) => Math.round(r.rating) === stars).length,
  }))
  const ratingTotal = ratingDist.reduce((a, b) => a + b.count, 0)

  const listingItems = listings?.items ?? []



  const igHandle = seller.ig_handle
  const igFollowers = seller.ig_follower_count
  const threadsHandle = (seller as any).threads_handle as string | null | undefined
  const threadsFollowers = (seller as any).threads_follower_count as number | null | undefined
  const hasSocial = !!(igHandle || threadsHandle)
  const formatBig = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M'
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.0', '') + 'K'
    return n.toString()
  }

  const stats = [
    { label: '代購商品', value: listingItems.length > 0 ? listingItems.length : (seller as any).listing_count ?? '-' },
    { label: '連線代購', value: connections?.length ?? '-' },
    { label: '平均評價', value: seller.avg_rating != null ? seller.avg_rating.toFixed(1) : '-', star: true, sub: seller.review_count ? `${seller.review_count} 則評價` : undefined },
    { label: '追蹤者', value: seller.follow_count.toLocaleString() },
  ]

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-4xl px-4 pb-20 pt-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-[13px] text-text-muted hover:text-text-strong transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
          返回
        </button>

        {/* ── Hero ── */}
        <div className="mt-6 grid grid-cols-[1.4fr_1fr] gap-8 items-start">
          {/* Left: avatar + info */}
          <div className="flex gap-6">
            <Avatar className="h-[104px] w-[104px] shrink-0">
              <AvatarImage src={seller.avatar_url ?? (seller as any).profile?.avatar_url ?? undefined} />
              <AvatarFallback className="text-3xl font-semibold bg-gradient-to-br from-[#2d3a5e] to-[#0f1a36] text-white">
                {seller.name[0]}
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col gap-3 pt-1 min-w-0">
              {/* Name + badge + date */}
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <h1 className="text-[28px] font-bold tracking-tight leading-none" style={{ fontFamily: 'Rubik, "Noto Sans TC", sans-serif' }}>
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
          <div className="flex flex-col gap-2 w-fit ml-auto">
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
                  onClick={() => router.push(`/messages?seller_id=${id}`)}
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
                    className="flex-1 min-w-0 min-h-[72px] flex items-center gap-2.5 group border border-border-soft rounded-[14px] bg-white px-3 hover:bg-surface-muted transition-colors"
                  >
                    <Image src="/images/instagram.png" alt="Instagram" width={24} height={24} className="rounded-[5px] shrink-0" />
                    <span className="text-[13.5px] font-semibold text-text-strong group-hover:text-text-muted leading-tight break-all">{igHandle}</span>
                  </a>
                  <a
                    href={`https://www.threads.net/@${threadsHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => recordSocialClick.mutate({ seller_id: id, platform: 'threads' })}
                    className="flex-1 min-w-0 min-h-[72px] flex items-center gap-2.5 group border border-border-soft rounded-[14px] bg-white px-3 hover:bg-surface-muted transition-colors"
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
                    className="w-[148px] shrink-0 min-h-[72px] flex items-center gap-2.5 group border border-border-soft rounded-[14px] bg-white px-3 hover:bg-surface-muted transition-colors overflow-hidden"
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
        <div className="mt-7 mb-9 grid grid-cols-4 border border-border-soft rounded-[14px] overflow-hidden bg-white">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={cn(
                'px-5 py-[18px] flex flex-col gap-1 items-center text-center justify-center',
                i < stats.length - 1 && 'border-r border-border-soft'
              )}
            >
              <div className="text-[11px] font-medium text-text-muted uppercase tracking-[.04em]">{s.label}</div>
              <div className="flex items-baseline gap-1.5" style={{ fontFamily: 'Rubik, sans-serif', fontSize: 24, fontWeight: 700, color: 'var(--text-strong)', letterSpacing: '-0.01em' }}>
                {s.value}
                {s.star && s.value !== '-' && <Star className="h-3.5 w-3.5 fill-text-strong stroke-text-strong mb-0.5" strokeWidth={1.5} />}
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
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <div className="flex gap-1 p-[3px] bg-surface-muted rounded-full">
                {LISTING_CATS.map(c => (
                  <button
                    key={c.key}
                    onClick={() => setListingCat(c.key)}
                    className={cn(
                      'px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition-colors',
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
              <div className="flex items-center gap-2 text-[12.5px] text-text-muted">
                <span>排序</span>
                <select
                  value={listingSort}
                  onChange={e => setListingSort(e.target.value)}
                  className="h-8 border border-border-soft rounded-lg px-2.5 text-[12.5px] bg-white cursor-pointer outline-none"
                >
                  <option value="latest">最新上架</option>
                  <option value="price-asc">價格 低 → 高</option>
                  <option value="price-desc">價格 高 → 低</option>
                </select>
              </div>
            </div>

            {listingItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
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
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
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
            <div className="grid grid-cols-[300px_1fr] gap-9">
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
                          {r.stars} <Star className="h-2.5 w-2.5 fill-text-muted stroke-text-muted" strokeWidth={1.5} />
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
                <ReviewForm sellerId={id} />
                {reviewItems.length > 0 ? (
                  <ReviewList reviews={reviewItems} sellerId={id} />
                ) : (
                  <EmptyState icon={Star} title="尚無評價" description="成為第一個留評價的人" />
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
