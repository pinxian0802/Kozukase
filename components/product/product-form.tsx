'use client'

import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { ImageUpload } from '@/components/shared/image-upload'
import { FormFieldError } from '@/components/shared/form-field-error'
import { FormSection, OptionalTag } from '@/components/shared/form-section'
import { BrandSelect } from '@/components/shared/brand-select'
import { PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'
import { scrollToFirstError } from '@/lib/utils/scroll-to-error'
import { trpc } from '@/lib/trpc/client'
import type { ProductCategory } from '@/lib/validators/product'

export interface ProductFormData {
  name: string
  brand_id: string | undefined
  modelNumber: string
  category: ProductCategory | ''
  regionId: string
  pendingFiles: File[]
}

interface ProductFormProps {
  initialName: string
  initialData?: ProductFormData
  onBack: () => void
  onContinue: (data: ProductFormData) => void
  isSubmitting?: boolean
}

export function ProductForm({ initialName, initialData, onBack, onContinue, isSubmitting }: ProductFormProps) {
  const [name, setName] = useState(initialData?.name ?? initialName)
  const [brandId, setBrandId] = useState(initialData?.brand_id ?? 'none')
  const [modelNumber, setModelNumber] = useState(initialData?.modelNumber ?? '')
  const [category, setCategory] = useState<ProductCategory | ''>(initialData?.category ?? '')
  const [regionId, setRegionId] = useState(initialData?.regionId ?? '')
  const [pendingFiles, setPendingFiles] = useState<File[]>(initialData?.pendingFiles ?? [])
  const [nameError, setNameError] = useState('')
  const [imageError, setImageError] = useState('')

  const { data: regions } = trpc.seller.getRegions.useQuery()


  const handleContinue = () => {
    const trimmedName = name.trim()
    let hasError = false

    if (!trimmedName) {
      setNameError('商品名稱為必填')
      hasError = true
    } else {
      setNameError('')
    }

    if (pendingFiles.length === 0) {
      setImageError('商品圖片為必填')
      hasError = true
    } else {
      setImageError('')
    }

    if (hasError) {
      scrollToFirstError()
      return
    }

    onContinue({
      name: trimmedName,
      brand_id: brandId === 'none' ? undefined : brandId,
      modelNumber,
      category,
      regionId,
      pendingFiles,
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 md:space-y-6">
      <div className="space-y-1.5">
        <div className="flex items-center gap-3 md:block md:relative">
          <Button type="button" variant="ghost" size="icon-sm" onClick={onBack} className="md:absolute md:right-full md:inset-y-0 md:my-auto md:mr-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-[17px] font-bold font-heading md:text-2xl">新增商品</h1>
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          商品圖片建議優先採用官方網站的圖片，讓買家能更清楚地確認這正是他想購買的商品。
        </p>
      </div>

      <div className="space-y-6 md:space-y-8">
        {/* ── 基本資訊 ── */}
        <FormSection title="基本資訊">
          <div>
            <Label>
              商品圖片
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">{pendingFiles.length} / 5</span>
            </Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">第一張為封面。請上傳與商品直接相關的圖片（商品本體照或官方圖），建議 800×800 px 以上、正方形</p>
            <div className="mt-1.5">
              <ImageUpload
                purpose="product"
                maxImages={5}
                reorderable
                images={[]}
                onChange={() => {}}
                pendingFiles={pendingFiles}
                onPendingFilesChange={(files) => {
                  setPendingFiles(files)
                  if (files.length > 0 && imageError) setImageError('')
                }}
                invalid={!!imageError}
              />
            </div>
            <FormFieldError message={imageError} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-name">商品名稱</Label>
            <Input
              id="product-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (nameError) setNameError('')
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
              placeholder="輸入商品名稱"
              aria-invalid={!!nameError}
            />
            <FormFieldError message={nameError} />
          </div>
        </FormSection>

        {/* ── 商品屬性 ── */}
        <FormSection title="商品屬性">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>品牌<OptionalTag /></Label>
              <BrandSelect
                value={brandId}
                onValueChange={setBrandId}
                placeholder="選擇或新增品牌"
                deferred
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="product-model">型號<OptionalTag /></Label>
              <Input
                id="product-model"
                value={modelNumber}
                onChange={(e) => setModelNumber(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
                placeholder="輸入型號"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>分類<OptionalTag /></Label>
              <Select value={category || null} onValueChange={(v) => setCategory(v as ProductCategory)}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇分類">
                    {(value: string | null) => value ? (PRODUCT_CATEGORY_LABELS[value] ?? value) : '選擇分類'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRODUCT_CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>商品國家<OptionalTag /></Label>
              <SearchableSelect
                value={regionId}
                onValueChange={setRegionId}
                options={(regions ?? []).map((r: { id: string; name: string }) => ({ value: r.id, label: r.name }))}
                placeholder="選擇國家"
                searchPlaceholder="搜尋國家..."
                emptyText="找不到相符的國家"
              />
            </div>
          </div>
        </FormSection>

        <div className="flex gap-3 pt-2">
          <Button type="button" size="sm" onClick={handleContinue} disabled={isSubmitting}>
            {isSubmitting ? '處理中...' : '下一步'}
          </Button>
        </div>
      </div>
    </div>
  )
}
