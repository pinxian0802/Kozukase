'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FormFieldError } from '@/components/shared/form-field-error'
import { ProductCard } from '@/components/product/product-card'
import { ProductPicker, type SelectedProduct } from '@/components/product/product-picker'
import { ProductForm, type ProductFormData } from '@/components/product/product-form'
import { trpc } from '@/lib/trpc/client'
import { useDeferredProductCreate } from '@/lib/hooks/use-deferred-product-create'
import type { ProductSearchResult } from '@/components/product/product-search'

export default function WishNewPage() {
  const router = useRouter()
  const [product, setProduct] = useState<SelectedProduct | null>(null)
  const [draftData, setDraftData] = useState<ProductFormData | null>(null)
  const [editingDraft, setEditingDraft] = useState(false)
  const [content, setContent] = useState('')
  const [contentError, setContentError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: brands } = trpc.brand.list.useQuery()
  const deferred = useDeferredProductCreate()
  const wishCreate = trpc.wish.create.useMutation()

  const handleSelectExisting = (p: ProductSearchResult) => {
    deferred.reset()
    setDraftData(null)
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

  const handleSubmit = async () => {
    if (!content.trim()) {
      setContentError('請填寫許願內容')
      return
    }
    setContentError('')
    setIsSubmitting(true)
    try {
      const productId = product!.id ?? (await deferred.createProductForListing())
      await wishCreate.mutateAsync({ product_id: productId, content: content.trim() })
      toast.success('許願已送出')
      router.push('/wishes')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '送出失敗，請重試')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Step: pick product ──
  if (!product) {
    return (
      <div className="px-4 py-6">
        <ProductPicker
          title="選擇或新增商品"
          description="先搜尋你想許願的商品。若平台已有相同商品，請直接選用，避免重複建立；若還沒有，再自行新增即可。"
          onSelectExisting={handleSelectExisting}
          onSubmitDraft={handleSubmitDraft}
          onCancel={() => router.back()}
        />
      </div>
    )
  }

  const isDraftProduct = !product.id

  // ── Step: edit the just-created draft product ──
  if (editingDraft && isDraftProduct && draftData) {
    return (
      <div className="px-4 py-6">
        <ProductForm
          initialName={draftData.name}
          initialData={draftData}
          onBack={() => setEditingDraft(false)}
          onContinue={handleSubmitDraft}
        />
      </div>
    )
  }

  // ── Step: fill in wish details ──
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center gap-3 mb-4 md:mb-6 md:block md:relative">
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setProduct(null)} className="md:absolute md:right-full md:inset-y-0 md:my-auto md:mr-1">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-[17px] font-bold font-heading md:text-2xl">填寫許願內容</h1>
      </div>
      <Card className="ring-0 shadow-sm py-0">
        <CardContent className="space-y-6 p-4 sm:p-8">
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
            <Button type="button" variant="ghost" size="sm" onClick={() => setProduct(null)} className="mt-2 w-full">
              重新選擇
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wish-content">許願內容</Label>
            <Textarea
              id="wish-content"
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                if (contentError) setContentError('')
              }}
              placeholder="描述你希望代購的細節，例如顏色、尺寸、版本..."
              rows={4}
              aria-invalid={!!contentError}
            />
            <FormFieldError message={contentError} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? '處理中...' : '送出許願'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
