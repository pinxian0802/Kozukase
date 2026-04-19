'use client'

import { useState } from 'react'
import { Search, Plus, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { trpc } from '@/lib/trpc/client'
import { shouldTriggerSearch } from '@/lib/utils/search'
import { ProductCard } from '@/components/product/product-card'

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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse overflow-hidden rounded-2xl border bg-white">
                  <div className="aspect-square bg-muted-foreground/10" />
                  <div className="space-y-2 p-3">
                    <div className="h-3 w-1/2 rounded bg-muted-foreground/10" />
                    <div className="h-4 w-3/4 rounded bg-muted-foreground/10" />
                    <div className="h-3 w-1/3 rounded bg-muted-foreground/10" />
                  </div>
                </div>
              ))}
            </div>
          ) : results && results.length > 0 ? (
            /* Product grid */
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {results.map((product: ProductSearchResult) => (
                <ProductCard
                  key={product.id}
                  product={{
                    id: product.id,
                    name: product.name,
                    brand: product.brand,
                    model_number: product.model_number,
                    catalog_image_url: product.catalog_image_url,
                  }}
                  onClick={() => onSelect({
                    id: product.id,
                    name: product.name,
                    brand: product.brand,
                    model_number: product.model_number,
                    catalog_image_url: product.catalog_image_url,
                  })}
                  linkToProduct={false}
                />
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
