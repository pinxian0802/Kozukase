'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { User, Heart, Bookmark, Star, UserCheck } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/product/product-card'
import { ListingCard } from '@/components/listing/listing-card'
import { SellerCard } from '@/components/seller/seller-card'
import { EmptyState } from '@/components/shared/empty-state'
import { trpc } from '@/lib/trpc/client'
import { useSession } from '@/lib/context/session-context'

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileContent />
    </Suspense>
  )
}

function ProfileContent() {
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get('tab') ?? 'bookmarks'
  const session = useSession()
  const { data: productBookmarks } = trpc.bookmark.myProductBookmarks.useQuery({ limit: 50 })
  const { data: listingBookmarks } = trpc.bookmark.myListingBookmarks.useQuery({ limit: 50 })
  const { data: wishes } = trpc.wish.myWishes.useQuery({ limit: 50 })
  const { data: follows } = trpc.follow.myFollows.useQuery({ limit: 50 })
  const { data: reviews } = trpc.review.myReviews.useQuery({ limit: 50 })

  if (!session?.profile) return null

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      {/* Profile header */}
      <div className="flex items-center gap-5 py-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={session.profile.avatar_url ?? undefined} />
          <AvatarFallback className="text-2xl">{session.profile.display_name?.[0]}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-xl font-bold font-heading">{session.profile.display_name}</h1>
          {session.profile.username && (
            <p className="text-sm text-muted-foreground">@{session.profile.username}</p>
          )}
        </div>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList variant="line" className="flex-wrap w-full border-b border-border">
          <TabsTrigger value="bookmarks"><Bookmark className="mr-1 h-4 w-4" />收藏</TabsTrigger>
          <TabsTrigger value="wishes"><Heart className="mr-1 h-4 w-4" />許願</TabsTrigger>
          <TabsTrigger value="follows"><UserCheck className="mr-1 h-4 w-4" />追蹤</TabsTrigger>
          <TabsTrigger value="reviews"><Star className="mr-1 h-4 w-4" />我的評價</TabsTrigger>
        </TabsList>

        <TabsContent value="bookmarks" className="mt-4 space-y-6">
          <div>
            <h3 className="font-medium mb-3">收藏的商品</h3>
            {productBookmarks?.items && productBookmarks.items.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {productBookmarks.items.map((b: any) => (
                  <ProductCard key={b.id} product={b.product} />
                ))}
              </div>
            ) : (
              <EmptyState icon={Bookmark} title="還沒有收藏的商品" />
            )}
          </div>
          <div>
            <h3 className="font-medium mb-3">收藏的上架商品</h3>
            {listingBookmarks?.items && listingBookmarks.items.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {listingBookmarks.items.map((b: any) => (
                  <ListingCard key={b.id} listing={b.listing} />
                ))}
              </div>
            ) : (
              <EmptyState icon={Bookmark} title="還沒有收藏的上架商品" />
            )}
          </div>
        </TabsContent>

        <TabsContent value="wishes" className="mt-4">
          <p className="text-sm text-muted-foreground mb-4">已許願 {wishes?.items?.length ?? 0}/20</p>
          {wishes?.items && wishes.items.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {wishes.items.map((w: any) => (
                <ProductCard key={w.id} product={w.product} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Heart} title="還沒有許願的商品" description="去搜尋你想要代購的商品吧！" />
          )}
        </TabsContent>

        <TabsContent value="follows" className="mt-4">
          {follows?.items && follows.items.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {follows.items.map((f: any) => (
                <SellerCard key={f.id} seller={f.seller} />
              ))}
            </div>
          ) : (
            <EmptyState icon={UserCheck} title="還沒有追蹤的代購" />
          )}
        </TabsContent>

        <TabsContent value="reviews" className="mt-4">
          {reviews?.items && reviews.items.length > 0 ? (
            <div className="space-y-3">
              {reviews.items.map((r: any) => (
                <div key={r.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{r.seller?.name ?? '賣家'}</span>
                    <span className="text-xs text-muted-foreground">{r.rating} 星</span>
                  </div>
                  {r.comment && <p className="text-sm">{r.comment}</p>}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Star} title="還沒有留過評價" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
