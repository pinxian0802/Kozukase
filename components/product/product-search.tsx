'use client'

import { useState } from 'react'
import { Search, Plus, Loader2, Package } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { trpc } from '@/lib/trpc/client'
import { shouldTriggerSearch } from '@/lib/utils/search'
import { cn } from '@/lib/utils'
import Image from 'next/image'

export interface ProductSearchResult {
  id: string
  name: string
  brand?: string | null
  model_number?: string | null
  catalog_image_url?: string | null
}

interface ProductSearchProps {
  onSelect: (product: ProductSearchResult) => void
  onCreateNew: (name: string) => void
}

export function ProductSearch({ onSelect, onCreateNew }: ProductSearchProps) {
  const [query, setQuery] = useState('')

  const { data: results, isLoading, isFetching } = trpc.product.search.useQuery(
    { query },
    { enabled: shouldTriggerSearch(query) }
  )

  const showLoading = (isLoading || isFetching) && shouldTriggerSearch(query)

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋商品名稱..."
          className="pl-10"
        />
        {showLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Results area */}
      {shouldTriggerSearch(query) && (
        <div className="space-y-3">
          {showLoading ? (
            /* Loading skeleton */
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl border bg-muted">
                  <div className="aspect-square rounded-t-xl bg-muted-foreground/10" />
                  <div className="space-y-1.5 p-2">
                    <div className="h-3 w-3/4 rounded bg-muted-foreground/10" />
                    <div className="h-2.5 w-1/2 rounded bg-muted-foreground/10" />
                  </div>
                </div>
              ))}
            </div>
          ) : results && results.length > 0 ? (
            /* Product grid */
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {results.map((product: any) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onSelect({
                    id: product.id,
                    name: product.name,
                    brand: product.brand,
                    model_number: product.model_number,
                    catalog_image_url: product.catalog_image_url,
                  })}
                  className={cn(
                    'group rounded-xl border bg-card text-left transition-transform duration-150',
                    'hover:scale-105 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                >
                  {/* Image */}
                  <div className="relative aspect-square overflow-hidden rounded-t-xl bg-muted">
                    {product.catalog_image_url ? (
                      <Image
                        src={product.catalog_image_url}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 33vw, 25vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-2">
                    <p className="truncate text-xs font-medium leading-snug">{product.name}</p>
                    {product.model_number && (
                      <p className="truncate text-[10px] text-muted-foreground">{product.model_number}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">找不到相符的商品</p>
          )}

          {/* Add new product option */}
          {query.trim() && !showLoading && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => onCreateNew(query.trim())}
            >
              <Plus className="h-4 w-4" />
              新增商品「{query.trim()}」
            </Button>
          )}
        </div>
      )}

      {/* Hint when query is empty */}
      {!shouldTriggerSearch(query) && (
        <p className="text-center text-sm text-muted-foreground">輸入商品名稱以搜尋</p>
      )}
    </div>
  )
}
