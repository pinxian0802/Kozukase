'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ProductCard } from '@/components/product/product-card'
import { ProductPicker, type SelectedProduct } from '@/components/product/product-picker'
import { ListingForm } from '@/components/listing/listing-form'
import { trpc } from '@/lib/trpc/client'
import { useDeferredProductCreate } from '@/lib/hooks/use-deferred-product-create'
import type { ProductSearchResult } from '@/components/product/product-search'
import type { ProductFormData } from '@/components/product/product-form'

export default function NewListingPage() {
  const router = useRouter()
  const [product, setProduct] = useState<SelectedProduct | null>(null)
  const { data: brands } = trpc.brand.list.useQuery()
  const deferred = useDeferredProductCreate()

  const handleSelectExisting = (p: ProductSearchResult) => {
    deferred.reset()
    setProduct({
      id: p.id,
      name: p.name,
      brand_name: p.brand ?? null,
      model_number: p.model_number,
      catalog_image_url: p.catalog_image_url,
    })
  }

  const handleSubmitDraft = (data: ProductFormData) => {
    const brandName = data.brand_id?.startsWith('__new__:')
      ? data.brand_id.slice(8)
      : brands?.find((brand) => brand.id === data.brand_id)?.name ?? null
    deferred.setDraft(data)
    setProduct({
      name: data.name,
      brand_id: data.brand_id || null,
      brand_name: brandName,
      model_number: data.modelNumber.trim() || null,
      catalog_image_url: data.pendingFile ? URL.createObjectURL(data.pendingFile) : null,
    })
  }

  // ── Step: pick product ──
  if (!product) {
    return (
      <ProductPicker
        title="新增代購"
        onSelectExisting={handleSelectExisting}
        onSubmitDraft={handleSubmitDraft}
        onCancel={() => router.back()}
      />
    )
  }

  // ── Step: fill in listing details ──
  const isDraftProduct = !product.id
  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => setProduct(null)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold font-heading">新增代購</h1>
      </div>
      <Card className="ring-0 shadow-sm py-0">
        <CardContent className="p-6 sm:p-8 space-y-4">
          <div>
            <Label>商品</Label>
            <div className="mt-1 w-fit">
              <ProductCard
                product={{
                  id: product.id ?? 'draft-product',
                  name: product.name,
                  brand: product.brand_name,
                  model_number: product.model_number,
                  catalog_image_url: product.catalog_image_url,
                }}
                linkToProduct={false}
                variant="compact"
                className="w-fit"
              />
            </div>
          </div>

          <Button type="button" variant="ghost" size="sm" onClick={() => setProduct(null)} className="w-full">
            重新選擇
          </Button>

          <ListingForm
            productId={product.id}
            mode="create"
            onCreateProduct={isDraftProduct ? deferred.createProductForListing : undefined}
          />
        </CardContent>
      </Card>
    </div>
  )
}
