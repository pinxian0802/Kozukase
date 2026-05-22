'use client'

import { useState } from 'react'
import { Bookmark } from 'lucide-react'
import { ProductCard } from '@/components/product/product-card'
import { ListingCard } from '@/components/listing/listing-card'
import { ConnectionCard } from '@/components/connection/connection-card'
import { EmptyState } from '@/components/shared/empty-state'
import { trpc } from '@/lib/trpc/client'
import { useSession } from '@/lib/context/session-context'

type BookmarkFilter = 'all' | 'product' | 'listing' | 'connection'

export default function FavoritesPage() {
  const session = useSession()
  const [bookmarkFilter, setBookmarkFilter] = useState<BookmarkFilter>('all')

  const { data: productBookmarks } = trpc.bookmark.myProductBookmarks.useQuery({ limit: 50 })
  const { data: listingBookmarks } = trpc.bookmark.myListingBookmarks.useQuery({ limit: 50 })
  const { data: connectionBookmarks } = trpc.bookmark.myConnectionBookmarks.useQuery({ limit: 50 })

  if (!session?.profile) return null

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold font-heading">我的收藏</h1>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {(
          [
            { key: 'all', label: '全部' },
            { key: 'product', label: '商品' },
            { key: 'listing', label: '代購' },
            { key: 'connection', label: '連線' },
          ] as { key: BookmarkFilter; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setBookmarkFilter(key)}
            className="h-8 px-4 rounded-full text-sm font-medium transition-all cursor-pointer"
            style={
              bookmarkFilter === key
                ? { background: 'var(--text-strong)', color: 'var(--text-inverse)' }
                : { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-soft)' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* 商品 */}
      {(bookmarkFilter === 'all' || bookmarkFilter === 'product') && (
        <div>
          {bookmarkFilter === 'all' && (
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">商品</h3>
          )}
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
      )}

      {/* 代購 */}
      {(bookmarkFilter === 'all' || bookmarkFilter === 'listing') && (
        <div>
          {bookmarkFilter === 'all' && (
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">代購</h3>
          )}
          {listingBookmarks?.items && listingBookmarks.items.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
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
      {(bookmarkFilter === 'all' || bookmarkFilter === 'connection') && (
        <div>
          {bookmarkFilter === 'all' && (
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">連線</h3>
          )}
          {connectionBookmarks?.items && connectionBookmarks.items.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {connectionBookmarks.items.map((b: any) => (
                <ConnectionCard key={b.id} connection={b.connection} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Bookmark} title="還沒有收藏的連線" />
          )}
        </div>
      )}
    </div>
  )
}
