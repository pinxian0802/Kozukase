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
import { ProductForm, type ProductFormData } from '@/components/product/product-form'

export default function NewListingPage() {
  const router = useRouter()
  const [product, setProduct] = useState<SelectedProduct | null>(null)
  const [draftData, setDraftData] = useState<ProductFormData | null>(null)
  const [editingDraft, setEditingDraft] = useState(false)
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
    setDraftData(data)
    setEditingDraft(false)
    setProduct({
      name: data.name,
      brand_id: data.brand_id || null,
      brand_name: brandName,
      model_number: data.modelNumber.trim() || null,
      catalog_image_url: data.pendingFiles[0] ? URL.createObjectURL(data.pendingFiles[0]) : null,
    })
  }

  // ── Step: pick product ──
  if (!product) {
    return (
      <ProductPicker
        title="選擇或新增商品"
        description="請先搜尋想要代購的商品。若清單中已收錄相同商品，建議直接選用，以免重複建立；若尚未收錄，再自行新增即可。"
        onSelectExisting={handleSelectExisting}
        onSubmitDraft={handleSubmitDraft}
        onCancel={() => router.back()}
      />
    )
  }

  // ── Step: edit the just-created draft product ──
  const isDraftProduct = !product.id
  if (editingDraft && isDraftProduct && draftData) {
    return (
      <ProductForm
        initialName={draftData.name}
        initialData={draftData}
        onBack={() => setEditingDraft(false)}
        onContinue={handleSubmitDraft}
      />
    )
  }

  // ── Step: fill in listing details ──
  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3 mb-4 md:mb-6 md:block md:relative">
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setProduct(null)} className="md:absolute md:right-full md:inset-y-0 md:my-auto md:mr-1">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-[17px] font-bold font-heading md:text-2xl">填寫代購資訊</h1>
      </div>
      <Card className="ring-0 shadow-sm py-0">
        <CardContent className="p-4 sm:p-8">
          <ListingForm
            productId={product.id}
            mode="create"
            onCreateProduct={isDraftProduct ? deferred.createProductForListing : undefined}
            productSlot={
              <>
                <div>
                  <Label>商品</Label>
                  <div className="mt-1 w-full max-w-sm">
                    <ProductCard
                      product={{
                        id: product.id ?? 'draft-product',
                        name: product.name,
                        brand: product.brand_name,
                        model_number: product.model_number,
                        catalog_image_url: product.catalog_image_url,
                      }}
                      linkToProduct={false}
                      onClick={isDraftProduct ? () => setEditingDraft(true) : undefined}
                      variant="compact"
                      className="w-full"
                    />
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setProduct(null)} className="w-full">
                  重新選擇
                </Button>
              </>
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
