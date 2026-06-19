'use client'

import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { SingleImageUpload } from '@/components/shared/single-image-upload'
import { FormFieldError } from '@/components/shared/form-field-error'
import { FormSection, OptionalTag } from '@/components/shared/form-section'
import { BrandSelect } from '@/components/shared/brand-select'
import { scrollToFirstError } from '@/lib/utils/scroll-to-error'
import { trpc } from '@/lib/trpc/client'

export interface WishFormData {
  name: string
  brand_id: string | undefined
  modelNumber: string
  regionId: string
  content: string
  pendingFile: File | null
}

interface WishFormProps {
  onBack: () => void
  onSubmit: (data: WishFormData) => void
  isSubmitting?: boolean
}

export function WishForm({ onBack, onSubmit, isSubmitting }: WishFormProps) {
  const [name, setName] = useState('')
  const [brandId, setBrandId] = useState('none')
  const [modelNumber, setModelNumber] = useState('')
  const [regionId, setRegionId] = useState('')
  const [content, setContent] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const [nameError, setNameError] = useState('')
  const [imageError, setImageError] = useState('')
  const [regionError, setRegionError] = useState('')
  const [contentError, setContentError] = useState('')

  const { data: regions } = trpc.seller.getRegions.useQuery()

  const handleSubmit = () => {
    let hasError = false

    if (!pendingFile) {
      setImageError('商品圖片為必填')
      hasError = true
    } else {
      setImageError('')
    }

    if (!name.trim()) {
      setNameError('商品名稱為必填')
      hasError = true
    } else {
      setNameError('')
    }

    if (!regionId) {
      setRegionError('請選擇國家')
      hasError = true
    } else {
      setRegionError('')
    }

    if (!content.trim()) {
      setContentError('請填寫許願內容')
      hasError = true
    } else {
      setContentError('')
    }

    if (hasError) {
      scrollToFirstError()
      return
    }

    onSubmit({
      name: name.trim(),
      brand_id: brandId === 'none' ? undefined : brandId,
      modelNumber,
      regionId,
      content: content.trim(),
      pendingFile,
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold font-heading">新增許願</h1>
      </div>

      <div className="space-y-6 md:space-y-8">
        {/* ── 商品資訊 ── */}
        <FormSection title="商品資訊">
          <div>
            <Label>商品圖片</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">建議 800×800 px 以上，正方形</p>
            <div className="mt-1.5">
              <SingleImageUpload
                purpose="product"
                value={null}
                onChange={() => {}}
                pendingFile={pendingFile}
                onPendingFileChange={(file) => {
                  setPendingFile(file)
                  if (file && imageError) setImageError('')
                }}
                invalid={!!imageError}
              />
            </div>
            <FormFieldError message={imageError} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wish-name">商品名稱</Label>
            <Input
              id="wish-name"
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
              <Label htmlFor="wish-model">型號<OptionalTag /></Label>
              <Input
                id="wish-model"
                value={modelNumber}
                onChange={(e) => setModelNumber(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
                placeholder="輸入型號"
              />
            </div>
          </div>
        </FormSection>

        {/* ── 許願詳情 ── */}
        <FormSection title="許願詳情">
          <div className="space-y-1.5">
            <Label>國家</Label>
            <SearchableSelect
              value={regionId}
              onValueChange={(v) => {
                setRegionId(v)
                if (regionError) setRegionError('')
              }}
              options={(regions ?? []).map((r: { id: string; name: string }) => ({ value: r.id, label: r.name }))}
              placeholder="選擇國家"
              searchPlaceholder="搜尋國家..."
              emptyText="找不到相符的國家"
            />
            <FormFieldError message={regionError} />
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
        </FormSection>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onBack}>
            取消
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? '處理中...' : '送出許願'}
          </Button>
        </div>
      </div>
    </div>
  )
}
