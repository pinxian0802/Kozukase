'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { ProductCard } from '@/components/product/product-card'
import { ProductPicker, type SelectedProduct } from '@/components/product/product-picker'
import { ListingForm } from '@/components/listing/listing-form'
import { trpc } from '@/lib/trpc/client'
import { useDeferredProductCreate } from '@/lib/hooks/use-deferred-product-create'
import type { ProductSearchResult } from '@/components/product/product-search'
import type { ProductFormData } from '@/components/product/product-form'

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: listing, isLoading } = trpc.listing.getById.useQuery({ id })
  const { data: brands } = trpc.brand.list.useQuery()
  const deferred = useDeferredProductCreate()

  const [reselecting, setReselecting] = useState(false)
  const [replacement, setReplacement] = useState<SelectedProduct | null>(null)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  if (!listing) return null

  const productRemoved = listing.product?.is_removed === true
  const isDraftReplacement = replacement !== null && !replacement.id

  const handleSelectExisting = (p: ProductSearchResult) => {
    deferred.reset()
    setReplacement({
      id: p.id,
      name: p.name,
      brand_name: p.brand ?? null,
      model_number: p.model_number,
      catalog_image_url: p.catalog_image_url,
    })
    setReselecting(false)
  }

  const handleSubmitDraft = (data: ProductFormData) => {
    const brandName = data.brand_id?.startsWith('__new__:')
      ? data.brand_id.slice(8)
      : brands?.find((brand) => brand.id === data.brand_id)?.name ?? null
    deferred.setDraft(data)
    setReplacement({
      name: data.name,
      brand_id: data.brand_id || null,
      brand_name: brandName,
      model_number: data.modelNumber.trim() || null,
      catalog_image_url: data.pendingFile ? URL.createObjectURL(data.pendingFile) : null,
    })
    setReselecting(false)
  }

  // ── Reselect overlay ──
  if (reselecting) {
    return (
      <ProductPicker
        title="重新選擇商品"
        onSelectExisting={handleSelectExisting}
        onSubmitDraft={handleSubmitDraft}
        onCancel={() => setReselecting(false)}
      />
    )
  }

  const removedProductBrand = typeof listing.product?.brand === 'string'
    ? listing.product.brand
    : listing.product?.brand?.name ?? null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold font-heading">編輯代購</h1>
      </div>

      <Card className="ring-0 shadow-sm">
        <CardContent className="p-6 sm:p-8 space-y-4">
          {productRemoved && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>此商品已被管理員移除，請重新選擇商品後重新送出（將重新送審）。</p>
              </div>
              <div>
                <Label>商品</Label>
                <div className="mt-1 w-fit">
                  {replacement ? (
                    <ProductCard
                      product={{
                        id: replacement.id ?? 'draft-product',
                        name: replacement.name,
                        brand: replacement.brand_name,
                        model_number: replacement.model_number,
                        catalog_image_url: replacement.catalog_image_url,
                      }}
                      linkToProduct={false}
                      variant="compact"
                      className="w-fit"
                    />
                  ) : (
                    <div className="opacity-50">
                      <ProductCard
                        product={{
                          id: listing.product?.id ?? 'removed',
                          name: listing.product?.name ?? '商品',
                          brand: removedProductBrand,
                          model_number: listing.product?.model_number,
                          catalog_image_url:
                            listing.product?.catalog_image?.thumbnail_url
                            ?? listing.product?.catalog_image?.url
                            ?? null,
                        }}
                        linkToProduct={false}
                        variant="compact"
                        className="w-fit"
                      />
                    </div>
                  )}
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setReselecting(true)} className="w-full">
                {replacement ? '重新選擇' : '重新選擇商品'}
              </Button>
            </div>
          )}

          <ListingForm
            productId={productRemoved ? replacement?.id : listing.product_id}
            mode="edit"
            initialData={listing}
            productRemoved={productRemoved}
            onCreateProduct={productRemoved && isDraftReplacement ? deferred.createProductForListing : undefined}
          />
        </CardContent>
      </Card>
    </div>
  )
}
