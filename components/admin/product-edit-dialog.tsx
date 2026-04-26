'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormFieldError } from '@/components/shared/form-field-error'
import { BrandSelect } from '@/components/shared/brand-select'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
  brand_id: string | null
  brand?: { name: string } | null
  model_number: string | null
  category: ProductCategory | null
  catalog_image_id: string | null
  catalog_image?: { url: string | null } | null
  product_images?: AdminProductImage[] | null
  aliases?: string[] | null
}

export type AdminProductEditValues = {
  id: string
  name: string
  brand_id: string | null
  model_number: string | null
  category: ProductCategory
  catalog_image_id: string | null
  aliases: string[]
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
  const [brandId, setBrandId] = useState(() => product?.brand_id ?? 'none')
  const [modelNumber, setModelNumber] = useState(() => product?.model_number ?? '')
  const [category, setCategory] = useState<ProductCategory>(() => product?.category ?? 'other')
  const [catalogImageId, setCatalogImageId] = useState(() => product?.catalog_image_id ?? 'none')
  const [aliases, setAliases] = useState<string[]>(() => product?.aliases ?? [])
  const [aliasInput, setAliasInput] = useState('')
  const [nameError, setNameError] = useState('')
  const imageLabelById = new Map([
    ['none', '不指定'],
    ...((product?.product_images ?? []).map((image, index) => [image.id, `圖片 ${index + 1}`] as const)),
  ])

  const addAlias = () => {
    const trimmed = aliasInput.trim()
    if (!trimmed || aliases.includes(trimmed)) return
    setAliases([...aliases, trimmed])
    setAliasInput('')
  }

  const removeAlias = (alias: string) => {
    setAliases(aliases.filter((a) => a !== alias))
  }

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
      brand_id: brandId === 'none' ? null : brandId,
      model_number: modelNumber.trim() || null,
      category,
      catalog_image_id: catalogImageId === 'none' ? null : catalogImageId,
      aliases,
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
                <Label>品牌</Label>
                <BrandSelect
                  value={brandId}
                  onValueChange={setBrandId}
                  placeholder="選擇或新增品牌"
                />
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

              <div className="space-y-2 md:col-span-2">
                <Label>搜尋別名</Label>
                <p className="text-xs text-muted-foreground">輸入其他語言的名稱（如英文、日文），讓買家更容易搜尋到此商品</p>
                <div className="flex gap-2">
                  <Input
                    value={aliasInput}
                    onChange={(e) => setAliasInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAlias() } }}
                    placeholder="輸入別名後按 Enter"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={addAlias} disabled={!aliasInput.trim()}>
                    新增
                  </Button>
                </div>
                {aliases.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {aliases.map((alias) => (
                      <Badge key={alias} variant="secondary" className="gap-1 pr-1">
                        {alias}
                        <button
                          type="button"
                          onClick={() => removeAlias(alias)}
                          className="ml-1 rounded-full hover:bg-muted"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
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
