'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormFieldError } from '@/components/shared/form-field-error'
import { PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'
import type { ProductCategory } from '@/lib/validators/product'

const CATEGORY_OPTIONS = Object.entries(PRODUCT_CATEGORY_LABELS)

type AdminProductImage = {
  id: string
  url: string
  r2_key: string
}

export type AdminEditableProduct = {
  id: string
  name: string
  brand: string | null
  model_number: string | null
  category: ProductCategory | null
  catalog_image_id: string | null
  catalog_image?: { url: string | null } | null
  product_images?: AdminProductImage[] | null
}

export type AdminProductEditValues = {
  id: string
  name: string
  brand: string | null
  model_number: string | null
  category: ProductCategory
  catalog_image_id: string | null
}

type ProductEditDialogProps = {
  product: AdminEditableProduct | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (values: AdminProductEditValues) => Promise<void> | void
  isPending?: boolean
}

export function ProductEditDialog({ product, open, onOpenChange, onSave, isPending = false }: ProductEditDialogProps) {
  const [name, setName] = useState(() => product?.name ?? '')
  const [brand, setBrand] = useState(() => product?.brand ?? '')
  const [modelNumber, setModelNumber] = useState(() => product?.model_number ?? '')
  const [category, setCategory] = useState<ProductCategory>(() => product?.category ?? 'other')
  const [catalogImageId, setCatalogImageId] = useState(() => product?.catalog_image_id ?? 'none')
  const [nameError, setNameError] = useState('')
  const imageLabelById = new Map([
    ['none', '不指定'],
    ...((product?.product_images ?? []).map((image, index) => [image.id, `圖片 ${index + 1}`] as const)),
  ])

  const handleSave = async () => {
    if (!product) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError('商品名稱為必填')
      return
    }

    setNameError('')

    await onSave({
      id: product.id,
      name: trimmedName,
      brand: brand.trim() || null,
      model_number: modelNumber.trim() || null,
      category,
      catalog_image_id: catalogImageId === 'none' ? null : catalogImageId,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>編輯商品</DialogTitle>
        </DialogHeader>

        {product && (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); handleSave() }} noValidate>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="admin-product-name">商品名稱</Label>
                <Input
                  id="admin-product-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (nameError) setNameError('')
                  }}
                  aria-invalid={!!nameError}
                />
                <FormFieldError message={nameError} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-product-brand">品牌</Label>
                <Input id="admin-product-brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="可留空" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-product-model">型號</Label>
                <Input id="admin-product-model" value={modelNumber} onChange={(e) => setModelNumber(e.target.value)} placeholder="可留空" />
              </div>

              <div className="space-y-2">
                <Label>分類</Label>
                <Select value={category} onValueChange={(value) => setCategory(value ?? 'other')}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇分類">
                      {(value) => (value ? PRODUCT_CATEGORY_LABELS[value as ProductCategory] ?? '選擇分類' : '選擇分類')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>封面圖片</Label>
                <Select value={catalogImageId} onValueChange={(value) => setCatalogImageId(value ?? 'none')}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇封面圖片">
                      {(value) => (value ? imageLabelById.get(value) ?? '選擇封面圖片' : '選擇封面圖片')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不指定</SelectItem>
                    {(product.product_images ?? []).map((image, index) => (
                      <SelectItem key={image.id} value={image.id}>
                        圖片 {index + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <button type="submit" disabled={isPending || !name.trim()} className={buttonVariants()}>
                儲存變更
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
