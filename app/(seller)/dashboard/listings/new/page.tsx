'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ProductCard } from '@/components/product/product-card'
import { ProductSearch, type ProductSearchResult } from '@/components/product/product-search'
import { ProductInfoFields, type ProductInfoData } from '@/components/product/product-info-fields'
import { ListingForm } from '@/components/listing/listing-form'
import { uploadImageFiles } from '@/components/shared/image-upload'
import { trpc } from '@/lib/trpc/client'
import type { SelectedProduct } from '@/components/product/product-picker'

const EMPTY_PRODUCT: ProductInfoData = { name: '', brand_id: 'none', modelNumber: '', category: '', regionId: '' }

export default function NewListingPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<SelectedProduct | null>(null)
  const [creatingName, setCreatingName] = useState<string | null>(null)
  const [productDraft, setProductDraft] = useState<ProductInfoData>(EMPTY_PRODUCT)
  const [productNameError, setProductNameError] = useState('')

  // 建立成功後快取商品 id，讓部分失敗的重試不會重複建立商品。
  const createdProductIdRef = useRef<string | null>(null)

  const createBrand = trpc.brand.create.useMutation()
  const createProduct = trpc.product.create.useMutation()
  const confirmProductImages = trpc.upload.confirmProductImages.useMutation()
  const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation()
  const deleteObjects = trpc.upload.deleteObjects.useMutation()

  const backToSearch = () => {
    setSelected(null)
    setCreatingName(null)
    setProductNameError('')
    createdProductIdRef.current = null
  }

  const handleSelectExisting = (p: ProductSearchResult) => {
    createdProductIdRef.current = null
    setCreatingName(null)
    setSelected({
      id: p.id,
      name: p.name,
      brand_name: p.brand ?? null,
      model_number: p.model_number,
      catalog_image_url: p.catalog_image_url,
    })
  }

  const handleCreateNew = (name: string) => {
    createdProductIdRef.current = null
    setSelected(null)
    setProductDraft({ ...EMPTY_PRODUCT, name })
    setProductNameError('')
    setCreatingName(name)
  }

  // 上架時建立全新商品（保守不併），並把第一張代購圖以 product 用途上傳一份當代表圖。
  const createProductForListing = async (coverFile: File | null): Promise<string> => {
    if (createdProductIdRef.current) return createdProductIdRef.current

    const name = productDraft.name.trim()
    if (!name) {
      setProductNameError('商品名稱為必填')
      throw new Error('商品名稱為必填')
    }
    setProductNameError('')

    let brandId: string | undefined = productDraft.brand_id === 'none' ? undefined : productDraft.brand_id
    if (brandId?.startsWith('__new__:')) {
      const brand = await createBrand.mutateAsync({ name: brandId.slice(8) })
      brandId = brand.id
    }

    const product = await createProduct.mutateAsync({
      name,
      brand_id: brandId,
      model_number: productDraft.modelNumber.trim() || undefined,
      category: productDraft.category || undefined,
      region_id: productDraft.regionId || undefined,
    })
    createdProductIdRef.current = product.id

    if (coverFile) {
      const uploaded = await uploadImageFiles('product', [coverFile], getPresignedUrl.mutateAsync)
      const keys = uploaded.flatMap((img) => [img.r2Key, img.thumbnailR2Key].filter(Boolean) as string[])
      try {
        await confirmProductImages.mutateAsync({
          product_id: product.id,
          images: uploaded.map((img, i) => ({
            r2_key: img.r2Key,
            url: img.url,
            thumbnail_r2_key: img.thumbnailR2Key ?? img.r2Key,
            thumbnail_url: img.thumbnailUrl ?? img.url,
            sort_order: i,
          })),
        })
      } catch (err) {
        await deleteObjects.mutateAsync({ r2Keys: keys }).catch(() => {})
        throw err
      }
    }

    return product.id
  }

  // ── Step: 搜尋商品 ──
  if (!selected && creatingName === null) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 md:space-y-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 md:block md:relative">
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => router.back()} className="md:absolute md:right-full md:inset-y-0 md:my-auto md:mr-1">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-[17px] font-bold font-heading md:text-2xl">選擇或新增商品</h1>
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            請先搜尋想要代購的商品。若清單中已收錄相同商品，建議直接選用以免重複；若沒有，點「沒有我的商品」即可直接填寫代購。
          </p>
        </div>
        <ProductSearch
          onSelect={handleSelectExisting}
          onCreateNew={handleCreateNew}
          createButtonLabel="沒有我的商品"
        />
      </div>
    )
  }

  const isNew = !selected
  const productInfoSlot = isNew ? (
    <ProductInfoFields value={productDraft} onChange={setProductDraft} nameError={productNameError} />
  ) : (
    <div>
      <div className="w-full max-w-sm">
        <ProductCard
          product={{
            id: selected!.id ?? 'selected-product',
            name: selected!.name,
            brand: selected!.brand_name,
            model_number: selected!.model_number,
            catalog_image_url: selected!.catalog_image_url,
          }}
          linkToProduct={false}
          variant="compact"
          className="w-full"
        />
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={backToSearch} className="mt-2 w-full">
        重新選擇
      </Button>
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3 mb-4 md:mb-6 md:block md:relative">
        <Button type="button" variant="ghost" size="icon-sm" onClick={backToSearch} className="md:absolute md:right-full md:inset-y-0 md:my-auto md:mr-1">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-[17px] font-bold font-heading md:text-2xl">填寫代購資訊</h1>
      </div>
      <Card className="ring-0 shadow-sm py-0">
        <CardContent className="p-4 sm:p-8">
          <ListingForm
            productId={selected?.id}
            mode="create"
            onCreateProduct={isNew ? createProductForListing : undefined}
            productInfoSlot={productInfoSlot}
          />
        </CardContent>
      </Card>
    </div>
  )
}
