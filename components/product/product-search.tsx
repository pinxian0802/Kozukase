'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Plus, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { trpc } from '@/lib/trpc/client'
import { shouldTriggerSearch } from '@/lib/utils/search'
import { cn } from '@/lib/utils'

interface ProductSearchProps {
  onSelect: (product: { id: string; name: string; brand?: string | null }) => void
  onCreateNew: (name: string) => void
}

export function ProductSearch({ onSelect, onCreateNew }: ProductSearchProps) {
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: results, isLoading } = trpc.product.search.useQuery(
    { query },
    { enabled: shouldTriggerSearch(query) }
  )

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShowResults(true)
          }}
          onFocus={() => setShowResults(true)}
          placeholder="搜尋商品名稱..."
          className="pl-10"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {showResults && shouldTriggerSearch(query) && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-lg border bg-white shadow-lg">
          <div className="max-h-60 overflow-y-auto p-1">
            {results && results.length > 0 ? (
              results.map((product: any) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => {
                    onSelect(product)
                    setShowResults(false)
                    setQuery(product.name)
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted"
                >
                  <span className="font-medium">{product.name}</span>
                  {product.brand && (
                    <span className="text-muted-foreground">({product.brand})</span>
                  )}
                </button>
              ))
            ) : !isLoading ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">找不到相符的商品</p>
            ) : null}
          </div>
          {query.trim() && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-primary"
                onClick={() => {
                  onCreateNew(query.trim())
                  setShowResults(false)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                新增商品「{query.trim()}」
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
