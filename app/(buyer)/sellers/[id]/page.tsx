'use client'

import { use, useState } from 'react'
import { UserPlus, UserCheck, Camera, MessageCircle, MapPin, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { StarRating } from '@/components/shared/star-rating'
import { SocialBadge } from '@/components/seller/social-badge'
import { ReportDialog } from '@/components/shared/report-dialog'
import { ReviewList } from '@/components/review/review-list'
import { ReviewForm } from '@/components/review/review-form'
import { ListingCard } from '@/components/listing/listing-card'
import { ConnectionCard } from '@/components/connection/connection-card'
import { EmptyState } from '@/components/shared/empty-state'
import { trpc } from '@/lib/trpc/client'
import { formatDate } from '@/lib/utils/format'
import { toast } from 'sonner'
import { Package, Star, Globe } from 'lucide-react'

export default function SellerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const utils = trpc.useUtils()
  const { data: seller, isLoading } = trpc.seller.getById.useQuery({ id })
  const { data: listings } = trpc.seller.getListings.useQuery({ sellerId: id })
  const { data: reviews } = trpc.review.getBySeller.useQuery({ seller_id: id })

  const followToggle = trpc.follow.toggle.useMutation({
    onSuccess: () => utils.seller.getById.invalidate({ id }),
    onError: (err) => toast.error(err.message),
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-8 w-48" />
      </div>
    )
  }

  if (!seller) return null

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      {/* Profile header */}
      <div className="flex flex-col md:flex-row items-start gap-6">
        <Avatar className="h-20 w-20">
          <AvatarImage src={seller.profile?.avatar_url ?? undefined} />
          <AvatarFallback className="text-2xl">{seller.name[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-heading">{seller.name}</h1>
            {seller.is_social_verified && <SocialBadge />}
          </div>

          {seller.avg_rating != null && (
            <div className="flex items-center gap-2">
              <StarRating value={seller.avg_rating} readonly />
              <span className="text-sm text-muted-foreground">{seller.avg_rating.toFixed(1)} ({seller.review_count} 則評價)</span>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            <Calendar className="inline mr-1 h-3 w-3" />
            加入於 {formatDate(seller.created_at)}
          </p>

          {seller.seller_regions && seller.seller_regions.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {seller.seller_regions.map((r: any) => (
                <Badge key={r.region?.id} variant="secondary" className="text-xs">{r.region?.name}</Badge>
              ))}
            </div>
          )}

          {/* Social links */}
          <div className="flex gap-2 pt-2">
            {seller.ig_handle && (
              <Button variant="outline" size="sm" render={<a href={`https://instagram.com/${seller.ig_handle}`} target="_blank" rel="noopener noreferrer" />}>
                  <Camera className="mr-1 h-4 w-4" />@{seller.ig_handle}
                  {seller.ig_follower_count != null && ` (${seller.ig_follower_count})`}
              </Button>
            )}
            {seller.threads_handle && (
              <Button variant="outline" size="sm" render={<a href={`https://threads.net/@${seller.threads_handle}`} target="_blank" rel="noopener noreferrer" />}>
                  <MessageCircle className="mr-1 h-4 w-4" />@{seller.threads_handle}
              </Button>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant={seller.isFollowing ? 'default' : 'outline'}
              size="sm"
              onClick={() => followToggle.mutate({ seller_id: id })}
              disabled={followToggle.isPending}
            >
              {seller.isFollowing ? <UserCheck className="mr-1 h-4 w-4" /> : <UserPlus className="mr-1 h-4 w-4" />}
              {seller.isFollowing ? '已追蹤' : '追蹤'}
            </Button>
            <ReportDialog seller_id={id} />
          </div>
        </div>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="listings">
        <TabsList>
          <TabsTrigger value="listings">上架商品</TabsTrigger>
          <TabsTrigger value="reviews">評價 ({seller.review_count})</TabsTrigger>
          <TabsTrigger value="connections">連線代購</TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="mt-4">
          {listings?.items && listings.items.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {listings.items.map((l: any) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Package} title="尚無上架商品" />
          )}
        </TabsContent>

        <TabsContent value="reviews" className="mt-4 space-y-6">
          <ReviewForm sellerId={id} />
          {reviews?.items && reviews.items.length > 0 ? (
            <ReviewList reviews={reviews.items} sellerId={id} />
          ) : (
            <EmptyState icon={Star} title="尚無評價" description="成為第一個留評價的人" />
          )}
        </TabsContent>

        <TabsContent value="connections" className="mt-4">
          <EmptyState icon={Globe} title="尚無進行中的連線代購" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
