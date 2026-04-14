'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductSearch } from '@/components/product/product-search'
import { ListingForm } from '@/components/listing/listing-form'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'

export default function NewListingPage() {
  const router = useRouter()
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string } | null>(null)
  const createProduct = trpc.product.create.useMutation()

  const handleCreateNew = async (name: string) => {
    try {
      const product = await createProduct.mutateAsync({ name })
      setSelectedProduct({ id: product.id, name: product.name })
    } catch (err) {
      toast.error('商品建立失敗')
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold font-heading">新增 Listing</h1>
      </div>

      {!selectedProduct ? (
        <div className="space-y-4">
          <p className="text-muted-foreground">第一步：搜尋或新增商品</p>
          <ProductSearch
            onSelect={(p) => setSelectedProduct({ id: p.id, name: p.name })}
            onCreateNew={handleCreateNew}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
            <span className="text-sm text-muted-foreground">商品：</span>
            <span className="font-medium">{selectedProduct.name}</span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedProduct(null)} className="ml-auto text-xs">
              重新選擇
            </Button>
          </div>
          <ListingForm productId={selectedProduct.id} mode="create" />
        </div>
      )}
    </div>
  )
}
