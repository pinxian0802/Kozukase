'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, MapPin, Calendar, Truck, CreditCard, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { SocialBadge } from '@/components/seller/social-badge'
import { SafeExternalLink } from '@/components/shared/safe-external-link'
import { ImageGallery } from '@/components/shared/image-gallery'
import { trpc } from '@/lib/trpc/client'
import { formatDate } from '@/lib/utils/format'

export default function ConnectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: connection, isLoading } = trpc.connection.getById.useQuery({ id })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Button variant="ghost" size="sm" render={<Link href="/connections" />} className="mb-4">
        <ArrowLeft className="mr-1 h-4 w-4" />返回
      </Button>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Images */}
        <div className="space-y-3">
          <ImageGallery
            images={galleryImages}
            title="連線代購圖片"
            emptyTitle="暫無圖片"
            emptyDescription="這則連線目前沒有上傳圖片"
          />
        </div>

        {/* Details */}
        <div className="space-y-6">
          {/* Title */}
          {connection.title && (
            <h1 className="text-2xl font-bold font-heading">{connection.title}</h1>
          )}

          {/* Region & Locations */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {connection.region && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                <span className="font-medium text-foreground">{connection.region.name}</span>
              </div>
            )}
            {connection.locations && connection.locations.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {connection.locations.map((loc: string) => (
                  <span
                    key={loc}
                    className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
                  >
                    {loc}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>
                {formatDate(connection.start_date)} ～ {formatDate(connection.end_date)}
              </span>
            </div>
            {connection.shipping_date && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Truck className="h-4 w-4 shrink-0" />
                <span>預計 {formatDate(connection.shipping_date)} 出貨</span>
              </div>
            )}
          </div>

          {/* Can Wish Badge */}
          {connection.can_wish && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#e8d9b8] bg-[#f0e9d8] px-3 py-1 text-xs font-medium text-[#8a6a2e]">
              <Star className="h-3 w-3" />
              可許願
            </div>
          )}

          {/* Description */}
          {connection.description && (
            <div>
              <h3 className="font-medium mb-1">連線說明</h3>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                {connection.description}
              </p>
            </div>
          )}

          {/* Billing Method */}
          {connection.billing_method && (
            <div className="rounded-xl border border-[#e8e3dc] bg-[#faf9f7] p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                計費方式
              </div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                {connection.billing_method}
              </p>
            </div>
          )}

          {/* Post Link */}
          {connection.post_link && (
            <SafeExternalLink href={connection.post_link} className="w-full">
              查看貼文 / 群組
            </SafeExternalLink>
          )}

          <Separator />

          {/* Seller Card */}
          {seller && (
            <Card>
              <CardContent className="p-4">
                <Link href={`/sellers/${seller.id}`} className="flex items-center gap-3 hover:opacity-80">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={seller.avatar_url ?? seller.profile?.avatar_url ?? undefined} />
                    <AvatarFallback>{seller.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{seller.name}</span>
                      {seller.is_social_verified && <SocialBadge />}
                    </div>
                    <p className="text-xs text-muted-foreground">代購賣家</p>
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
