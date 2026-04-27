'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/product/product-card'
import { ProductSearch, type ProductSearchResult } from '@/components/product/product-search'
import { ProductForm, type ProductFormData } from '@/components/product/product-form'
import { ListingForm } from '@/components/listing/listing-form'
import { uploadImageFiles } from '@/components/shared/image-upload'
import { trpc } from '@/lib/trpc/client'

type SelectedProduct = {
  id?: string
  name: string
  brand_id?: string | null
  brand_name?: string | null
  model_number?: string | null
  catalog_image_url?: string | null
}

type Step =
  | { type: 'select' }
  | { type: 'create'; initialName: string }
  | { type: 'listing'; product: SelectedProduct }

export default function NewListingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>({ type: 'select' })

  // Cache the product id after it's been created in DB.
  // If the user retries after a partial failure, we reuse this id
  // instead of calling createProduct.mutateAsync again.
  const createdProductIdRef = useRef<string | null>(null)

  // Stores product form data after the user completes step 2,
  // so createProductForListing can read it when ListingForm submits.
  const draftProductRef = useRef<ProductFormData | null>(null)

  const confirmProductImage = trpc.upload.confirmProductImage.useMutation()
  const { data: brands } = trpc.brand.list.useQuery()
  const createProduct = trpc.product.create.useMutation()
  const deleteObjects = trpc.upload.deleteObjects.useMutation()
  const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation()

  const handleOpenCreate = (name: string) => {
    createdProductIdRef.current = null
    draftProductRef.current = null
    setStep({ type: 'create', initialName: name })
  }

  const handleProductFormContinue = (data: ProductFormData) => {
    const brandName = brands?.find((brand) => brand.id === data.brand_id)?.name ?? null
    draftProductRef.current = data
    setStep({
      type: 'listing',
      product: {
        name: data.name,
        brand_id: data.brand_id || null,
        brand_name: brandName,
        model_number: data.modelNumber.trim() || null,
        catalog_image_url: data.pendingFile
          ? URL.createObjectURL(data.pendingFile)
          : null,
      },
    })
  }

  const createProductForListing = async () => {
    // If a previous attempt already created the product in DB, reuse that id
    // instead of creating a duplicate.
    if (createdProductIdRef.current) {
      return createdProductIdRef.current
    }

    const draft = draftProductRef.current!
    const product = await createProduct.mutateAsync({
      name: draft.name,
      brand_id: draft.brand_id || undefined,
      model_number: draft.modelNumber.trim() || undefined,
      category: draft.category || undefined,
      region_id: draft.regionId || undefined,
    })

    // Persist the id immediately after DB creation so retries are safe
    createdProductIdRef.current = product.id

    if (draft.pendingFile) {
      const uploaded = await uploadImageFiles('product', [draft.pendingFile], getPresignedUrl.mutateAsync)
      if (uploaded[0]) {
        try {
          await confirmProductImage.mutateAsync({
            product_id: product.id,
            r2_key: uploaded[0].r2Key,
            url: uploaded[0].url,
            thumbnail_r2_key: uploaded[0].thumbnailR2Key ?? uploaded[0].r2Key,
            thumbnail_url: uploaded[0].thumbnailUrl ?? uploaded[0].url,
          })
        } catch (err) {
          // confirmProductImage failed: clean up the orphan R2 object.
          // The product record itself stays — it's a valid catalog entry
          // and the caller's rollback will delete it if the whole flow fails.
          await deleteObjects.mutateAsync({
            r2Keys: [uploaded[0].r2Key, uploaded[0].thumbnailR2Key].filter(Boolean) as string[],
          }).catch(() => {})
          throw err
        }
      }
    }

    return product.id
  }

  // ── Step: select product ─────────────────────────────────────────────────
  if (step.type === 'select') {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold font-heading">新增代購</h1>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">搜尋或新增商品</p>
          <ProductSearch
            onSelect={(p: ProductSearchResult) =>
              setStep({
                type: 'listing',
                product: {
                  id: p.id,
                  name: p.name,
                  brand_name: p.brand ?? null,
                  model_number: p.model_number,
                  catalog_image_url: p.catalog_image_url,
                },
              })
            }
            onCreateNew={handleOpenCreate}
          />
        </div>
      </div>
    )
  }

  // ── Step: create new product ─────────────────────────────────────────────
  if (step.type === 'create') {
    return (
      <ProductForm
        initialName={step.initialName}
        onBack={() => setStep({ type: 'select' })}
        onContinue={handleProductFormContinue}
      />
    )
  }

  // ── Step: fill in listing details ────────────────────────────────────────
  const { product } = step
  const isDraftProduct = !product.id
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => setStep(product.id ? { type: 'select' } : { type: 'create', initialName: product.name })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold font-heading">新增代購</h1>
      </div>
      <div className="space-y-4">
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
        />

        <Button type="button" variant="ghost" size="sm" onClick={() => setStep({ type: 'select' })} className="w-full">
          重新選擇
        </Button>

        <ListingForm
          productId={product.id}
          mode="create"
          onCreateProduct={isDraftProduct ? createProductForListing : undefined}
        />
      </div>
    </div>
  )
}
