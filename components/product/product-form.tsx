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
import { BrandSelect } from '@/components/shared/brand-select'
import { PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'
import { trpc } from '@/lib/trpc/client'
import type { ProductCategory } from '@/lib/validators/product'

export interface ProductFormData {
  name: string
  brand_id: string
  modelNumber: string
  category: ProductCategory | ''
  regionId: string
  pendingFiles: File[]
}

interface ProductFormProps {
  initialName: string
  onBack: () => void
  onContinue: (data: ProductFormData) => void
}

export function ProductForm({ initialName, onBack, onContinue }: ProductFormProps) {
  const [name, setName] = useState(initialName)
  const [brandId, setBrandId] = useState('none')
  const [modelNumber, setModelNumber] = useState('')
  const [category, setCategory] = useState<ProductCategory | ''>('')
  const [regionId, setRegionId] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
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

    if (hasError) return

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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold font-heading">新增商品</h1>
      </div>

      <div className="space-y-5">
        <div>
          <Label>商品目錄圖片 <span className="text-destructive">*</span></Label>
          <p className="text-xs text-muted-foreground mb-2">此圖片用於商品目錄，與上架圖片不同</p>
          <ImageUpload
            purpose="product"
            maxImages={1}
            images={[]}
            onChange={() => {}}
            pendingFiles={pendingFiles}
            onPendingFilesChange={(files) => {
              setPendingFiles(files)
              if (files.length > 0 && imageError) setImageError('')
            }}
            invalid={!!imageError}
          />
          <FormFieldError message={imageError} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="product-name">商品名稱 <span className="text-destructive">*</span></Label>
          <Input
            id="product-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (nameError) setNameError('')
            }}
            placeholder="輸入商品名稱"
            aria-invalid={!!nameError}
          />
          <FormFieldError message={nameError} />
        </div>

        <div className="space-y-1.5">
          <Label>
            品牌 <span className="text-muted-foreground text-xs">（選填）</span>
          </Label>
          <BrandSelect
            value={brandId}
            onValueChange={setBrandId}
            placeholder="選擇或新增品牌"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="product-model">
            型號 <span className="text-muted-foreground text-xs">（選填）</span>
          </Label>
          <Input
            id="product-model"
            value={modelNumber}
            onChange={(e) => setModelNumber(e.target.value)}
            placeholder="輸入型號"
          />
        </div>

        <div className="space-y-1.5">
          <Label>
            分類 <span className="text-muted-foreground text-xs">（選填）</span>
          </Label>
          <Select value={category} onValueChange={(v) => setCategory(v as ProductCategory)}>
            <SelectTrigger>
              <SelectValue placeholder="選擇分類" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRODUCT_CATEGORY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>
            商品國家 <span className="text-muted-foreground text-xs">（選填）</span>
          </Label>
          <SearchableSelect
            value={regionId}
            onValueChange={setRegionId}
            options={(regions ?? []).map((r: { id: string; name: string }) => ({ value: r.id, label: r.name }))}
            placeholder="選擇國家"
            searchPlaceholder="搜尋國家..."
            emptyText="找不到相符的國家"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onBack}>
            取消
          </Button>
          <Button type="button" onClick={handleContinue}>
            下一步
          </Button>
        </div>
      </div>
    </div>
  )
}
