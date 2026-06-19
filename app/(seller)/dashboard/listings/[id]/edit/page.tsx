'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ProductCard } from '@/components/product/product-card'
import { ProductPicker, type SelectedProduct } from '@/components/product/product-picker'
import { ListingForm } from '@/components/listing/listing-form'
import { ListingFormSkeleton } from '@/components/dashboard/listing-form-skeleton'
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
    return <ListingFormSkeleton />
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

  const adminTakenDown = listing.inactive_reason === 'admin' && !!listing.admin_note

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-[15px] font-bold font-heading md:text-2xl">編輯代購</h1>
      </div>

      {adminTakenDown && (
        <Alert variant="destructive" title="代購已被管理員下架">
          因「{listing.admin_note}」遭下架，請修改後重新送出審核。
        </Alert>
      )}

      {productRemoved && (
        <Alert variant="warning" title="商品已被管理員移除">
          請重新選擇商品後再重新送出。
        </Alert>
      )}

      <Card className="ring-0 shadow-sm py-0">
        <CardContent className="px-4 py-4 sm:px-8 sm:py-5">
          <ListingForm
            productId={productRemoved ? replacement?.id : listing.product_id}
            mode="edit"
            initialData={listing}
            productRemoved={productRemoved}
            onCreateProduct={productRemoved && isDraftReplacement ? deferred.createProductForListing : undefined}
            productSlot={productRemoved ? (
              <div className="space-y-3">
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
                <Button
                  type="button"
                  variant="cta-outline"
                  size="sm"
                  onClick={() => setReselecting(true)}
                  className="w-full"
                >
                  {replacement ? '重新選擇' : '重新選擇商品'}
                </Button>
              </div>
            ) : undefined}
          />
        </CardContent>
      </Card>
    </div>
  )
}
