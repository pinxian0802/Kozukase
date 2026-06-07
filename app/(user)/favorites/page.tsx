'use client'

import { useState } from 'react'
import { Bookmark, Heart } from 'lucide-react'
import { ProductCard } from '@/components/product/product-card'
import { ListingCard } from '@/components/listing/listing-card'
import { ConnectionCard } from '@/components/connection/connection-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { X, Package } from 'lucide-react'
import Image from 'next/image'
import { trpc } from '@/lib/trpc/client'
import { useSession } from '@/lib/context/session-context'
import { toast } from 'sonner'
import { getCardImageUrl } from '@/lib/utils/image-variants.mjs'

type BookmarkFilter = 'all' | 'product' | 'listing' | 'connection' | 'wish'

export default function FavoritesPage() {
  const session = useSession()
  const [filter, setFilter] = useState<BookmarkFilter>('all')
  const utils = trpc.useUtils()

  const { data: productBookmarks } = trpc.bookmark.myProductBookmarks.useQuery({ limit: 50 })
  const { data: listingBookmarks } = trpc.bookmark.myListingBookmarks.useQuery({ limit: 50 })
  const { data: connectionBookmarks } = trpc.bookmark.myConnectionBookmarks.useQuery({ limit: 50 })
  const { data: myWishes } = trpc.wish.myWishes.useQuery({ limit: 50 })

  const wishDelete = trpc.wish.delete.useMutation({
    onSuccess: () => {
      toast.success('已取消許願')
      utils.wish.myWishes.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  if (!session?.profile) return null

  const tabs: { key: BookmarkFilter; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'product', label: '商品' },
    { key: 'listing', label: '代購' },
    { key: 'connection', label: '連線' },
    { key: 'wish', label: '許願' },
  ]

  return (
    <div className="mx-auto max-w-4xl px-3 py-3 space-y-4 md:px-4 md:py-6 md:space-y-6">
      <h1 className="text-base font-bold font-heading md:text-xl">我的收藏</h1>

      {/* Filter chips */}
      <div className="flex gap-1.5 flex-wrap md:gap-2">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-all cursor-pointer md:px-4 md:py-2 md:text-sm ${
              filter === key
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-brand-50 hover:text-brand-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 商品 */}
      {(filter === 'all' || filter === 'product') && (
        <div>
          {filter === 'all' && (
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">商品</h3>
          )}
          {productBookmarks?.items && productBookmarks.items.length > 0 ? (
            <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-4">
              {productBookmarks.items.map((b: any) => (
                <ProductCard key={b.id} product={b.product} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Bookmark} title="還沒有收藏的商品" />
          )}
        </div>
      )}

      {/* 代購 */}
      {(filter === 'all' || filter === 'listing') && (
        <div>
          {filter === 'all' && (
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">代購</h3>
          )}
          {listingBookmarks?.items && listingBookmarks.items.length > 0 ? (
            <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-4">
              {listingBookmarks.items.map((b: any) => (
                <ListingCard key={b.id} listing={b.listing} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Bookmark} title="還沒有收藏的代購" />
          )}
        </div>
      )}

      {/* 連線 */}
      {(filter === 'all' || filter === 'connection') && (
        <div>
          {filter === 'all' && (
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">連線</h3>
          )}
          {connectionBookmarks?.items && connectionBookmarks.items.length > 0 ? (
            <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-4">
              {connectionBookmarks.items.map((b: any) => (
                <ConnectionCard key={b.id} connection={b.connection} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Bookmark} title="還沒有收藏的連線" />
          )}
        </div>
      )}

      {/* 許願 */}
      {(filter === 'all' || filter === 'wish') && (
        <div>
          {filter === 'all' && (
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">許願</h3>
          )}
          {myWishes?.items && myWishes.items.length > 0 ? (
            <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {myWishes.items.map((wish: any) => {
                const imageUrl = getCardImageUrl(wish.product as any)
                return (
                  <div key={wish.id} className="relative overflow-hidden rounded-xl border border-border-soft bg-surface-card shadow-sm md:rounded-2xl">
                    {/* 叉叉按鈕 */}
                    <button
                      type="button"
                      onClick={() => { if (wish.product?.id) wishDelete.mutate({ product_id: wish.product.id }) }}
                      disabled={wishDelete.isPending}
                      className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 disabled:opacity-50"
                    >
                      <X className="h-3 w-3" />
                    </button>

                    {/* 商品圖片 */}
                    <div className="relative aspect-square bg-muted">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={wish.product?.name ?? ''}
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
                    <div className="p-3 space-y-1">
                      <p className="font-bold leading-snug line-clamp-2 text-foreground text-sm">{wish.product?.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{wish.content}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState icon={Heart} title="還沒有許願" description="去許願榜新增你想代購的商品吧！" />
          )}
        </div>
      )}
    </div>
  )
}
