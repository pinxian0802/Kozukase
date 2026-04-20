'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ImageUpload, uploadImageFiles } from '@/components/shared/image-upload'
import { FormFieldError } from '@/components/shared/form-field-error'
import { ProductCard } from '@/components/product/product-card'
import { ProductSearch, type ProductSearchResult } from '@/components/product/product-search'
import { ListingForm } from '@/components/listing/listing-form'
import { trpc } from '@/lib/trpc/client'

type SelectedProduct = {
  id?: string
  name: string
  brand?: string | null
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

  // Create product form state
  const [productName, setProductName] = useState('')
  const [productBrand, setProductBrand] = useState('')
  const [productModelNumber, setProductModelNumber] = useState('')
  const [productPendingFiles, setProductPendingFiles] = useState<File[]>([])
  const [productNameError, setProductNameError] = useState('')

  const confirmProductImage = trpc.upload.confirmProductImage.useMutation()
  const createProduct = trpc.product.create.useMutation()
  const deleteObjects = trpc.upload.deleteObjects.useMutation()
  const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation()

  const handleOpenCreate = (name: string) => {
    setProductName(name)
    setProductBrand('')
    setProductModelNumber('')
    setProductPendingFiles([])
    setProductNameError('')
    // Reset cached product id — user is starting a brand new product
    createdProductIdRef.current = null
    setStep({ type: 'create', initialName: name })
  }

  const handleContinueToListing = () => {
    const trimmedName = productName.trim()
    if (!trimmedName) {
      setProductNameError('商品名稱為必填')
      return
    }
    setProductNameError('')
    setStep({
      type: 'listing',
      product: {
        name: trimmedName,
        brand: productBrand.trim() || null,
        model_number: productModelNumber.trim() || null,
        catalog_image_url: productPendingFiles[0]
          ? URL.createObjectURL(productPendingFiles[0])
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

    const product = await createProduct.mutateAsync({
      name: productName.trim(),
      brand: productBrand.trim() || undefined,
      model_number: productModelNumber.trim() || undefined,
    })

    // Persist the id immediately after DB creation so retries are safe
    createdProductIdRef.current = product.id

    if (productPendingFiles.length > 0) {
      const uploaded = await uploadImageFiles('product', productPendingFiles, getPresignedUrl.mutateAsync)
      if (uploaded[0]) {
        try {
          await confirmProductImage.mutateAsync({
            product_id: product.id,
            r2_key: uploaded[0].r2Key,
            url: uploaded[0].url,
          })
        } catch (err) {
          // confirmProductImage failed: clean up the orphan R2 object.
          // The product record itself stays — it’s a valid catalog entry
          // and the caller’s rollback will delete it if the whole flow fails.
          await deleteObjects.mutateAsync({ r2Keys: [uploaded[0].r2Key] }).catch(() => {})
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
            <p className="text-muted-foreground">第一步：搜尋或新增商品</p>
          <ProductSearch
            onSelect={(p: ProductSearchResult) =>
              setStep({
                type: 'listing',
                product: {
                  id: p.id,
                  name: p.name,
                  brand: p.brand,
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
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => setStep({ type: 'select' })}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
            <h1 className="text-2xl font-bold font-heading">新增商品</h1>
        </div>

        <div className="space-y-5">
          {/* Catalog image */}
          <div>
            <Label>商品目錄圖片（選填）</Label>
            <p className="text-xs text-muted-foreground mb-2">此圖片用於商品目錄，與上架圖片不同</p>
            <ImageUpload
              purpose="product"
              maxImages={1}
              images={[]}
              onChange={() => {}}
              pendingFiles={productPendingFiles}
              onPendingFilesChange={setProductPendingFiles}
            />
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="product-name">商品名稱 *</Label>
            <Input
              id="product-name"
              value={productName}
              onChange={(e) => {
                setProductName(e.target.value)
                if (productNameError) setProductNameError('')
              }}
              placeholder="輸入商品名稱"
              aria-invalid={!!productNameError}
            />
            <FormFieldError message={productNameError} />
          </div>

          {/* Model number (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="product-model">
              型號 <span className="text-muted-foreground text-xs">（選填）</span>
            </Label>
            <Input
              id="product-model"
              value={productModelNumber}
              onChange={(e) => setProductModelNumber(e.target.value)}
              placeholder="輸入型號"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setStep({ type: 'select' })}>
              取消
            </Button>
            <Button type="button" onClick={handleContinueToListing}>
              下一步
            </Button>
          </div>
        </div>
      </div>
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
            brand: product.brand,
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
