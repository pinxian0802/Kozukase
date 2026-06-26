'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { FormFieldError } from '@/components/shared/form-field-error'
import { OptionalTag } from '@/components/shared/form-section'
import { BrandSelect } from '@/components/shared/brand-select'
import { PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'
import { trpc } from '@/lib/trpc/client'
import type { ProductCategory } from '@/lib/validators/product'

export interface ProductInfoData {
  name: string
  /** BrandSelect 原始值：'none' | uuid | '__new__:品牌名' */
  brand_id: string
  modelNumber: string
  category: ProductCategory | ''
  regionId: string
}

interface ProductInfoFieldsProps {
  value: ProductInfoData
  onChange: (value: ProductInfoData) => void
  nameError?: string
}

export function ProductInfoFields({ value, onChange, nameError }: ProductInfoFieldsProps) {
  const { data: regions } = trpc.seller.getRegions.useQuery()
  const set = (patch: Partial<ProductInfoData>) => onChange({ ...value, ...patch })

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="product-name">商品名稱</Label>
        <Input
          id="product-name"
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
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
            value={value.brand_id}
            onValueChange={(v) => set({ brand_id: v })}
            placeholder="選擇或新增品牌"
            deferred
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="product-model">型號<OptionalTag /></Label>
          <Input
            id="product-model"
            value={value.modelNumber}
            onChange={(e) => set({ modelNumber: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
            placeholder="輸入型號"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>分類<OptionalTag /></Label>
          <Select value={value.category || null} onValueChange={(v) => set({ category: v as ProductCategory })}>
            <SelectTrigger>
              <SelectValue placeholder="選擇分類">
                {(v: string | null) => v ? (PRODUCT_CATEGORY_LABELS[v] ?? v) : '選擇分類'}
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
            value={value.regionId}
            onValueChange={(v) => set({ regionId: v })}
            options={(regions ?? []).map((r: { id: string; name: string }) => ({ value: r.id, label: r.name }))}
            placeholder="選擇國家"
            searchPlaceholder="搜尋國家..."
            emptyText="找不到相符的國家"
          />
        </div>
      </div>
    </div>
  )
}
