import Image from 'next/image'
import { Package } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getCardImageUrl } from '@/lib/utils/image-variants.mjs'

export type WishCardWish = {
  id: string
  content: string
  created_at: string
  product: {
    id: string
    name: string
    brand?: { name: string } | string | null
    model_number?: string | null
    catalog_image?: { url: string; thumbnail_url?: string | null } | null
  } | null
  profile: {
    display_name: string | null
    avatar_url: string | null
  } | null
}

export function WishCard({ wish }: { wish: WishCardWish }) {
  if (!wish.product) return null

  const imageUrl = getCardImageUrl(wish.product as any)
  const brandLabel = typeof wish.product.brand === 'string'
    ? wish.product.brand
    : wish.product.brand?.name ?? null
  const displayName = wish.profile?.display_name ?? '匿名'

  return (
    <div className="overflow-hidden rounded-2xl border border-border-soft bg-surface-card shadow-sm">
      {/* 商品圖片 */}
      <div className="relative aspect-square bg-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={wish.product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/30">
            <Package className="h-7 w-7" />
          </div>
        )}
      </div>

      {/* 內容 */}
      <div className="p-4 space-y-2">
        {brandLabel && (
          <p className="truncate text-xs text-muted-foreground">{brandLabel}</p>
        )}
        <p className="font-bold leading-snug line-clamp-2 text-foreground">
          {wish.product.name}
        </p>
        <p className="text-sm text-muted-foreground line-clamp-2">{wish.content}</p>

        {/* 許願者 */}
        <div className="flex items-center gap-2 pt-1">
          <Avatar className="h-6 w-6">
            <AvatarImage src={wish.profile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-[10px]">{displayName[0]}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">{displayName}</span>
        </div>
      </div>
    </div>
  )
}
