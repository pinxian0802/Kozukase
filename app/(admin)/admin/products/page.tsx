'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Search, Trash2, Tags, Package } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/empty-state'
import { PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'
import { trpc } from '@/lib/trpc/client'
import { getCardImageUrl } from '@/lib/utils/image-variants.mjs'
import { ProductEditDialog, type AdminEditableProduct, type AdminProductEditValues } from '@/components/admin/product-edit-dialog'
import { toast } from 'sonner'
import type { ProductCategory } from '@/lib/validators/product'

const CATEGORIES = Object.entries(PRODUCT_CATEGORY_LABELS)

const rowGridClass = 'grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(180px,1.4fr)_minmax(100px,0.8fr)_max-content]'

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
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-[28px]" />)}</div>
      ) : data?.items && data.items.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">商品</th>
                <th className="px-4 py-3 font-medium">分類</th>
                <th className="px-4 py-3 font-medium">狀態</th>
                <th className="px-4 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((product) => {
                const imageUrl = getCardImageUrl(product)
                const isLocalPreviewUrl = imageUrl?.startsWith('blob:') || imageUrl?.startsWith('data:')
                const brandLabel = typeof product.brand === 'string' ? product.brand : (product.brand as { name: string } | null)?.name ?? null

                return (
                  <tr key={product.id} className={`border-b last:border-b-0 ${product.is_removed ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-muted/40">
                          {imageUrl ? (
                            <Image src={imageUrl} alt={product.name} fill sizes="48px" className="object-cover" unoptimized={isLocalPreviewUrl} />
                          ) : (
                            <div className="flex h-full items-center justify-center text-muted-foreground/30">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{product.name}</p>
                          {brandLabel && <p className="truncate text-xs text-muted-foreground">{brandLabel}</p>}
                          {product.model_number && <p className="truncate text-xs text-muted-foreground">{product.model_number}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={product.category ?? ''}
                        onValueChange={(val) => setCategory.mutate({ id: product.id, category: val as ProductCategory })}
                      >
                        <SelectTrigger className="h-8 w-36 text-xs">
                          <SelectValue placeholder="未分類">
                            {(value: string) => value ? (PRODUCT_CATEGORY_LABELS[value] ?? value) : undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      {product.is_removed
                        ? <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />已移除</span>
                        : <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500" />正常</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditingProduct(product)}>編輯</Button>
                        {!product.is_removed && (
                          <Dialog open={removeId === product.id} onOpenChange={(open) => { if (!open) setRemoveId(null) }}>
                            <DialogTrigger nativeButton render={<Button size="sm" variant="destructive" onClick={() => setRemoveId(product.id)} />}>
                              <Trash2 className="mr-1 h-3 w-3" />移除
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
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
