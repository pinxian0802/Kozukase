import Image from 'next/image'
import Link from 'next/link'
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
  const displayName = wish.profile?.display_name ?? '匿名'

  return (
    <Link
      href={`/wishes/${wish.id}`}
      aria-label={`查看「${wish.product.name}」的許願`}
      className="group block overflow-hidden rounded-none bg-white md:rounded-2xl md:border md:border-border-soft md:shadow-[0_2px_12px_rgba(15,23,42,0.08)] md:transition-shadow md:hover:shadow-lg">
      {/* 商品圖片 */}
      <div className="relative aspect-square w-full overflow-hidden bg-muted md:aspect-auto md:h-[180px]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={wish.product.name}
            fill
            sizes="(max-width: 640px) 50vw, 33vw"
            className="object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/30">
            <Package className="h-7 w-7" />
          </div>
        )}
      </div>

      {/* 內容 */}
      <div className="px-1.5 py-1.5 space-y-0.5 md:p-4 md:space-y-2">
        <p className="leading-tight line-clamp-2 min-h-[2lh] text-foreground text-[10px] md:font-bold md:leading-snug md:text-base md:min-h-0">
          {wish.product.name}
        </p>
        <p className="text-[9px] text-muted-foreground line-clamp-1 md:text-sm md:line-clamp-2">{wish.content}</p>

        {/* 許願者 */}
        <div className="flex items-center gap-1 md:gap-2 md:pt-1">
          <Avatar className="h-3.5 w-3.5 md:h-6 md:w-6">
            <AvatarImage src={wish.profile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-[7px] md:text-[10px]">{displayName[0]}</AvatarFallback>
          </Avatar>
          <span className="text-[9px] text-neutral-400 truncate md:text-xs">{displayName}</span>
        </div>
      </div>
    </Link>
  )
}
