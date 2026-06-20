'use client'

import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductSearch, type ProductSearchResult } from '@/components/product/product-search'
import { ProductForm, type ProductFormData } from '@/components/product/product-form'

export type SelectedProduct = {
  id?: string
  name: string
  brand_id?: string | null
  brand_name?: string | null
  model_number?: string | null
  catalog_image_url?: string | null
}

interface ProductPickerProps {
  title: string
  onSelectExisting: (product: ProductSearchResult) => void
  onSubmitDraft: (data: ProductFormData) => void
  onCancel: () => void
}

/**
 * Full-view product picker: search an existing product or create a new one.
 * Renders ProductForm (its own "新增商品" chrome) for the create sub-step.
 */
export function ProductPicker({ title, onSelectExisting, onSubmitDraft, onCancel }: ProductPickerProps) {
  const [creatingName, setCreatingName] = useState<string | null>(null)

  if (creatingName !== null) {
    return (
      <ProductForm
        initialName={creatingName}
        onBack={() => setCreatingName(null)}
        onContinue={onSubmitDraft}
      />
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 md:space-y-6">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon-sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-[17px] font-bold font-heading md:text-2xl">{title}</h1>
      </div>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">搜尋或新增商品</p>
        <ProductSearch
          onSelect={onSelectExisting}
          onCreateNew={(name) => setCreatingName(name)}
        />
      </div>
    </div>
  )
}
