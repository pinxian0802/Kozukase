'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Search, Trash2, Tags } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/empty-state'
import { PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'
import { trpc } from '@/lib/trpc/client'
import { ProductEditDialog, type AdminEditableProduct, type AdminProductEditValues } from '@/components/admin/product-edit-dialog'
import { toast } from 'sonner'
import type { ProductCategory } from '@/lib/validators/product'

const CATEGORIES = Object.entries(PRODUCT_CATEGORY_LABELS)

export default function AdminProductsPage() {
  const [search, setSearch] = useState('')
  const [editingProduct, setEditingProduct] = useState<AdminEditableProduct | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [removeReason, setRemoveReason] = useState('')
  const utils = trpc.useUtils()

  const { data, isLoading } = trpc.admin.listProducts.useQuery({ search: search || undefined, limit: 50 })

  const updateProduct = trpc.admin.updateProduct.useMutation({
    onSuccess: () => {
      toast.success('已更新商品')
      setEditingProduct(null)
      utils.admin.listProducts.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  const removeProduct = trpc.admin.removeProduct.useMutation({
    onSuccess: () => {
      toast.success('已移除商品')
      setRemoveId(null)
      setRemoveReason('')
      utils.admin.listProducts.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  const setCategory = trpc.admin.setProductCategory.useMutation({
    onSuccess: () => { toast.success('已更新分類'); utils.admin.listProducts.invalidate() },
    onError: (err) => toast.error(err.message),
  })

  const getProductImageUrl = (product: AdminEditableProduct) => product.catalog_image?.url ?? product.product_images?.[0]?.url ?? null

  const handleEditSave = async (values: AdminProductEditValues) => {
    await updateProduct.mutateAsync(values)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">商品管理</h1>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋商品..."
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : data?.items && data.items.length > 0 ? (
        <div className="space-y-2">
          {data.items.map((product) => (
            <div key={product.id} className={`flex items-center justify-between rounded-lg border p-4 ${product.is_removed ? 'opacity-50' : ''}`}>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {getProductImageUrl(product) ? (
                    <Image
                      src={getProductImageUrl(product)}
                      alt={product.name}
                      fill
                      sizes="48px"
                      unoptimized
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{product.name}</p>
                  {product.brand && <span className="text-xs text-muted-foreground">{product.brand}</span>}
                  {product.is_removed && <Badge variant="destructive">已移除</Badge>}
                  {product.category && <Badge variant="secondary">{PRODUCT_CATEGORY_LABELS[product.category] ?? product.category}</Badge>}
                </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={product.category ?? ''}
                  onValueChange={(val) => setCategory.mutate({ id: product.id, category: val as ProductCategory })}
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue placeholder="分類" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => setEditingProduct(product)}>
                  編輯
                </Button>
                {!product.is_removed && (
                  <Dialog open={removeId === product.id} onOpenChange={(open) => { if (!open) setRemoveId(null) }}>
                    <DialogTrigger nativeButton render={<Button size="sm" variant="destructive" onClick={() => setRemoveId(product.id)} />}>
                        <Trash2 className="h-3 w-3" />
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>移除商品</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <p className="text-sm">確定要移除「{product.name}」？此操作會影響所有相關商品上架、許願和收藏。</p>
                        <div>
                          <Label>移除原因</Label>
                          <Textarea value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} placeholder="請填寫原因..." className="mt-1" />
                        </div>
                        <Button variant="destructive" className="w-full" onClick={() => removeProduct.mutate({ id: product.id })} disabled={removeProduct.isPending || !removeReason.trim()}>
                          確認移除
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Tags} title="沒有找到商品" />
      )}

      <ProductEditDialog
        key={editingProduct?.id ?? 'closed'}
        product={editingProduct}
        open={!!editingProduct}
        onOpenChange={(open) => {
          if (!open) setEditingProduct(null)
        }}
        onSave={handleEditSave}
        isPending={updateProduct.isPending}
      />
    </div>
  )
}
