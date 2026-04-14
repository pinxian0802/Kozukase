'use client'

import { Tags } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'

export default function AdminCategoriesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">分類管理</h1>
      <p className="text-muted-foreground">目前使用固定 8 大分類。可在「商品管理」頁面設定每個商品的分類。</p>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {Object.entries(PRODUCT_CATEGORY_LABELS).map(([key, label]) => (
          <div key={key} className="rounded-lg border p-4 text-center">
            <Tags className="mx-auto mb-2 h-6 w-6 text-primary" />
            <p className="font-medium">{label}</p>
            <Badge variant="outline" className="mt-1">{key}</Badge>
          </div>
        ))}
      </div>
    </div>
  )
}
