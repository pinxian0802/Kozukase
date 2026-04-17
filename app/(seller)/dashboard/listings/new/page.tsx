'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ImageUpload, uploadImageFiles } from '@/components/shared/image-upload'
import { ProductSearch, type ProductSearchResult } from '@/components/product/product-search'
import { ListingForm } from '@/components/listing/listing-form'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'

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

  const confirmProductImage = trpc.upload.confirmProductImage.useMutation()
  const createProduct = trpc.product.create.useMutation()

  const handleOpenCreate = (name: string) => {
    setProductName(name)
    setProductBrand('')
    setProductModelNumber('')
    setProductPendingFiles([])
    // Reset cached product id — user is starting a brand new product
    createdProductIdRef.current = null
    setStep({ type: 'create', initialName: name })
  }

  const handleContinueToListing = () => {
    if (!productName.trim()) {
      toast.error('請輸入商品名稱')
      return
    }
    setStep({
      type: 'listing',
      product: {
        name: productName.trim(),
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
      const uploaded = await uploadImageFiles('product', productPendingFiles)
      if (uploaded[0]) {
        await confirmProductImage.mutateAsync({
          product_id: product.id,
          r2_key: uploaded[0].r2Key,
          url: uploaded[0].url,
        })
      }
    }

    return product.id
  }

  // ── Step: select product ─────────────────────────────────────────────────
  if (step.type === 'select') {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
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
          <Button variant="ghost" size="icon" onClick={() => setStep({ type: 'select' })}>
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
              onChange={(e) => setProductName(e.target.value)}
              placeholder="輸入商品名稱"
            />
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
            <Button variant="outline" onClick={() => setStep({ type: 'select' })}>
              取消
            </Button>
            <Button onClick={handleContinueToListing} disabled={!productName.trim()}>
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
        <Button variant="ghost" size="icon" onClick={() => setStep(product.id ? { type: 'select' } : { type: 'create', initialName: product.name })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold font-heading">新增代購</h1>
      </div>
      <div className="space-y-4">
        {/* Selected product card */}
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
            {product.catalog_image_url ? (
              <Image
                src={product.catalog_image_url}
                alt={product.name}
                fill
                className="object-cover"
                sizes="64px"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Package className="h-6 w-6 text-muted-foreground/40" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{product.name}</p>
            {product.model_number && (
              <p className="truncate text-xs text-muted-foreground">{product.model_number}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep({ type: 'select' })}
            className="shrink-0 text-xs"
          >
            重新選擇
          </Button>
        </div>

        <ListingForm
          productId={product.id}
          mode="create"
          onCreateProduct={isDraftProduct ? createProductForListing : undefined}
        />
      </div>
    </div>
  )
}
