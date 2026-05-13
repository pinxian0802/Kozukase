'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  UserPlus, UserCheck, MapPin, Calendar,
  Star, Package, Globe, CheckCircle2, MessageCircle, ChevronLeft
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
          className={i <= Math.round(value) ? 'fill-[#111] stroke-[#111]' : 'fill-none stroke-[#111]'}
          strokeWidth={1.5}
        />
      ))}
    </div>
  )
}

export default function SellerPage({ params }: { params: Promise<{ id: string }> }) {
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
          className="inline-flex items-center gap-1 text-[13px] text-[#888] hover:text-[#111] transition-colors cursor-pointer"
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
              {/* Name + badge */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-[28px] font-bold tracking-tight leading-none" style={{ fontFamily: 'Rubik, "Noto Sans TC", sans-serif' }}>
                    {seller.name}
                  </h1>
                  {seller.is_social_verified && <SocialBadge />}
                </div>
                <div className="flex items-center gap-2.5 text-[12.5px] text-[#888]">
                  {igHandle && (
                    <span className="font-medium" style={{ fontFamily: 'Rubik, sans-serif' }}>@{igHandle}</span>
                  )}
                  {igHandle && <span className="text-[#ddd]">·</span>}
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    加入於 {formatDate(seller.created_at)}
                  </span>
                </div>
              </div>

              {/* Bio */}
              {(seller as any).bio && (
                <p className="text-[14px] leading-[1.65] text-[#444] max-w-[520px] whitespace-pre-wrap">
                  {(seller as any).bio}
                </p>
              )}

              {/* Region chips */}
              {seller.seller_regions && seller.seller_regions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {seller.seller_regions.map((r: any) => (
                    <span
                      key={r.region?.id}
                      className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12.5px] font-medium bg-[#f5f5f5] text-[#444]"
                    >
                      <MapPin className="h-3 w-3" />
                      {r.region?.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Rating (mobile fallback if no stats bar) */}
              {seller.avg_rating != null && (
                <div className="flex items-center gap-2 md:hidden">
                  <StarRow value={seller.avg_rating} />
                  <span className="text-[12.5px] text-[#888]">{seller.avg_rating.toFixed(1)} ({seller.review_count} 則評價)</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: actions + social card */}
          <div className="flex flex-col gap-3.5">
            {/* Action buttons */}
            <div className="flex gap-2">
              {!isOwnProfile && (
                <button
                  onClick={() => followToggle.mutate({ seller_id: id })}
                  disabled={followToggle.isPending}
                  className={cn(
                    'flex-1 h-11 rounded-[10px] text-[14px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors',
                    seller.isFollowing
                      ? 'bg-[#f0f0f0] text-[#111] hover:bg-[#e4e4e4]'
                      : 'bg-[#111] text-white hover:bg-[#222]'
                  )}
                >
                  {seller.isFollowing
                    ? <><UserCheck className="h-4 w-4" /> 已追蹤</>
                    : <><UserPlus className="h-4 w-4" /> 追蹤賣家</>}
                </button>
              )}
              {!isOwnProfile && (
                <button
                  onClick={() => router.push(`/messages?seller_id=${id}`)}
                  className="h-11 px-4 rounded-[10px] bg-white text-[#222] border border-[#e0e0e0] text-[14px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#f7f7f7] transition-colors"
                >
                  <MessageCircle className="h-4 w-4" /> 訊息
                </button>
              )}
              <SharePopover
                title={seller.name ?? ''}
                triggerClassName="h-11 w-11 rounded-[10px] bg-white text-[#444] border border-[#e0e0e0] inline-flex items-center justify-center hover:bg-[#f7f7f7] transition-colors cursor-pointer"
              />
              <ReportDialog seller_id={id} iconOnly />
            </div>


          </div>
        </div>

        {/* ── Stats bar ── */}
        <div className="mt-7 mb-9 grid grid-cols-4 border border-[#ececec] rounded-[14px] overflow-hidden bg-white">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={cn(
                'px-5 py-[18px] flex flex-col gap-1 items-center text-center justify-center',
                i < stats.length - 1 && 'border-r border-[#ececec]'
              )}
            >
              <div className="text-[11px] font-medium text-[#888] uppercase tracking-[.04em]">{s.label}</div>
              <div className="flex items-baseline gap-1.5" style={{ fontFamily: 'Rubik, sans-serif', fontSize: 24, fontWeight: 700, color: '#111', letterSpacing: '-0.01em' }}>
                {s.value}
                {s.star && s.value !== '-' && <Star className="h-3.5 w-3.5 fill-[#111] stroke-[#111] mb-0.5" strokeWidth={1.5} />}
              </div>
              {s.sub && <div className="text-[11.5px] text-[#999]">{s.sub}</div>}
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="listings">
          <TabsList variant="line" className="flex-wrap w-full border-b border-border">
            <TabsTrigger value="listings">代購商品</TabsTrigger>
            <TabsTrigger value="connections">連線代購</TabsTrigger>
            <TabsTrigger value="reviews">評價</TabsTrigger>
          </TabsList>

          {/* ── Products tab ── */}
          <TabsContent value="listings" className="mt-5">
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <div className="flex gap-1 p-[3px] bg-[#f5f5f5] rounded-full">
                {LISTING_CATS.map(c => (
                  <button
                    key={c.key}
                    onClick={() => setListingCat(c.key)}
                    className={cn(
                      'px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition-colors',
                      listingCat === c.key
                        ? 'bg-white text-[#111] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                        : 'text-[#777] hover:text-[#444]'
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-2 text-[12.5px] text-[#666]">
                <span>排序</span>
                <select
                  value={listingSort}
                  onChange={e => setListingSort(e.target.value)}
                  className="h-8 border border-[#e8e8e8] rounded-lg px-2.5 text-[12.5px] bg-white cursor-pointer outline-none"
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
              <aside className="bg-[#fafafa] border border-[#ececec] rounded-[14px] p-[22px] h-fit">
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span style={{ fontFamily: 'Rubik, sans-serif', fontSize: 44, fontWeight: 700, letterSpacing: '-0.02em', color: '#111' }}>
                    {seller.avg_rating?.toFixed(1) ?? '-'}
                  </span>
                  <span className="text-[14px] text-[#888]">/ 5</span>
                </div>
                {seller.avg_rating != null && <StarRow value={seller.avg_rating} size={16} />}
                <div className="text-[12.5px] text-[#888] mt-1.5">共 {seller.review_count ?? 0} 則評價</div>
                <div className="mt-4 flex flex-col gap-2">
                  {ratingDist.map(r => {
                    const pct = ratingTotal ? (r.count / ratingTotal) * 100 : 0
                    return (
                      <div key={r.stars} className="grid items-center gap-2.5 text-[12px]" style={{ gridTemplateColumns: '36px 1fr 28px' }}>
                        <span className="inline-flex items-center gap-1 text-[#555]">
                          {r.stars} <Star className="h-2.5 w-2.5 fill-[#555] stroke-[#555]" strokeWidth={1.5} />
                        </span>
                        <div className="h-1.5 bg-[#ececec] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#111] rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[#888] text-right">{r.count}</span>
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
