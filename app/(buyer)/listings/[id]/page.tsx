'use client'

import { use } from 'react'
import { ArrowLeft, Bookmark, ExternalLink, Camera, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { StarRating } from '@/components/shared/star-rating'
import { CopyButton } from '@/components/shared/copy-button'
import { ReportDialog } from '@/components/shared/report-dialog'
import { ImageGallery } from '@/components/shared/image-gallery'
import { SocialBadge } from '@/components/seller/social-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { trpc } from '@/lib/trpc/client'
import { formatPrice, formatShippingDays } from '@/lib/utils/format'
import { toast } from 'sonner'

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const utils = trpc.useUtils()
  const { data: listing, isLoading } = trpc.listing.getById.useQuery({ id })

  const bookmarkToggle = trpc.bookmark.toggleListingBookmark.useMutation({
    onSuccess: () => utils.listing.getById.invalidate({ id }),
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
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
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Button variant="ghost" size="sm" render={<Link href={listing.product ? `/products/${listing.product.id}` : '/search'} />} className="mb-4">
          <ArrowLeft className="mr-1 h-4 w-4" />返回
      </Button>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Images */}
        <div className="space-y-3">
          <ImageGallery
            images={galleryImages}
            title="刊登圖片"
            emptyTitle="暫無刊登圖片"
            emptyDescription="這則刊登目前沒有上傳圖片"
          />
        </div>

        {/* Details */}
        <div className="space-y-6">
          {listing.product && (
            <Link href={`/products/${listing.product.id}`} className="text-sm text-primary hover:underline">
              {listing.product.name}
            </Link>
          )}

          {/* Price */}
          <div>
            <p className="text-3xl font-bold text-primary">
              {formatPrice(listing.price, listing.is_price_on_request)}
            </p>
            <Badge variant="outline" className="mt-2">
              {formatShippingDays(listing.shipping_days)}
            </Badge>
          </div>

          {/* Specs */}
          {listing.specs && listing.specs.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">規格</h3>
              {listing.specs.map((spec: any, i: number) => (
                <div key={i} className="flex gap-2 text-sm">
                  <span className="text-muted-foreground">{spec.type}：</span>
                  <span>{spec.is_all ? '都有' : spec.options?.join('、')}</span>
                </div>
              ))}
            </div>
          )}

          {/* Note */}
          {listing.note && (
            <div>
              <h3 className="font-medium mb-1">備註</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{listing.note}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <CopyButton text={inquiryText} label="複製詢問語" />
            <Button variant="outline" size="sm" render={<a href={listing.post_url} target="_blank" rel="noopener noreferrer" />}>
                <ExternalLink className="mr-1 h-4 w-4" />查看原始貼文
            </Button>
            <Button
              variant={listing.hasBookmarked ? 'default' : 'outline'}
              size="sm"
              onClick={() => bookmarkToggle.mutate({ listing_id: id })}
              disabled={bookmarkToggle.isPending}
            >
              <Bookmark className={`mr-1 h-4 w-4 ${listing.hasBookmarked ? 'fill-current' : ''}`} />
              收藏
            </Button>
          </div>

          <Separator />

          {/* Seller info */}
          {listing.seller && (
            <Card>
              <CardContent className="p-4">
                <Link href={`/sellers/${listing.seller.id}`} className="flex items-center gap-3 hover:opacity-80">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={listing.seller.profile?.avatar_url ?? undefined} />
                    <AvatarFallback>{listing.seller.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{listing.seller.name}</span>
                      {listing.seller.is_social_verified && <SocialBadge />}
                    </div>
                    {listing.seller.avg_rating != null && (
                      <div className="flex items-center gap-1 mt-1">
                        <StarRating value={listing.seller.avg_rating} readonly size="sm" />
                        <span className="text-xs text-muted-foreground">({listing.seller.review_count})</span>
                      </div>
                    )}
                  </div>
                </Link>
                <div className="mt-3 flex gap-2">
                  {listing.seller.ig_handle && (
                    <Button variant="outline" size="sm" render={<a href={`https://instagram.com/${listing.seller.ig_handle}`} target="_blank" rel="noopener noreferrer" />}>
                        <Camera className="mr-1 h-4 w-4" />IG
                    </Button>
                  )}
                  {listing.seller.threads_handle && (
                    <Button variant="outline" size="sm" render={<a href={`https://threads.net/@${listing.seller.threads_handle}`} target="_blank" rel="noopener noreferrer" />}>
                        <MessageCircle className="mr-1 h-4 w-4" />Threads
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <ReportDialog listing_id={id} />
        </div>
      </div>
    </div>
  )
}
