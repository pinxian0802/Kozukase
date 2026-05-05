'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Check, X, Package, Tags, Globe, Pencil, Trash2, GitMerge } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { EmptyState } from '@/components/shared/empty-state'
import { ProductEditDialog, type AdminEditableProduct, type AdminProductEditValues } from '@/components/admin/product-edit-dialog'
import { ProductCard } from '@/components/product/product-card'
import { trpc } from '@/lib/trpc/client'
import { shouldTriggerSearch } from '@/lib/utils/search'
import { formatDate, PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'
import { getCardImageUrl } from '@/lib/utils/image-variants.mjs'
import { toast } from 'sonner'
import type { ProductCategory } from '@/lib/validators/product'

const CATEGORIES = Object.entries(PRODUCT_CATEGORY_LABELS)
const rowGridClass = 'grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(180px,1.4fr)_minmax(100px,0.8fr)_max-content]'

// ─── Products Tab ─────────────────────────────────────────────────────────────

function ProductsTab() {
  const utils = trpc.useUtils()
  const { data: products, isLoading } = trpc.admin.todayProducts.useQuery()
  const [editingProduct, setEditingProduct] = useState<AdminEditableProduct | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [removeReason, setRemoveReason] = useState('')
  const [mergeId, setMergeId] = useState<string | null>(null)
  const [mergeTarget, setMergeTarget] = useState<string | null>(null)
  const [mergeSearch, setMergeSearch] = useState('')
  const [showMergeList, setShowMergeList] = useState(false)

  const { data: mergeSearchResults } = trpc.product.search.useQuery(
    { query: mergeSearch },
    { enabled: !!mergeId && shouldTriggerSearch(mergeSearch) }
  )

  const updateProduct = trpc.admin.updateProduct.useMutation({
    onSuccess: () => { toast.success('已更新商品'); setEditingProduct(null); utils.admin.todayProducts.invalidate() },
    onError: (err) => toast.error(err.message),
  })
  const removeProduct = trpc.admin.removeProduct.useMutation({
    onSuccess: () => { toast.success('已移除商品'); setRemoveId(null); setRemoveReason(''); utils.admin.todayProducts.invalidate() },
    onError: (err) => toast.error(err.message),
  })
  const setCategory = trpc.admin.setProductCategory.useMutation({
    onSuccess: () => { toast.success('已更新分類'); utils.admin.todayProducts.invalidate() },
    onError: (err) => toast.error(err.message),
  })
  const mergeProduct = trpc.admin.mergeProduct.useMutation({
    onSuccess: () => {
      toast.success('已合併商品')
      setMergeId(null); setMergeTarget(null); setMergeSearch(''); setShowMergeList(false)
      utils.admin.todayProducts.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-[28px]" />)}</div>
  if (!products?.length) return <EmptyState icon={Package} title="今天還沒有新增商品" />

  return (
    <>
      <div className="space-y-4">
        {products.map((product) => {
          const imageUrl = getCardImageUrl(product)
          const isLocalPreviewUrl = imageUrl?.startsWith('blob:') || imageUrl?.startsWith('data:')
          const brandLabel = typeof product.brand === 'string' ? product.brand : (product.brand as { name: string } | null)?.name ?? null
          return (
            <div key={product.id} className={`overflow-hidden rounded-[28px] border bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)] ${product.is_removed ? 'opacity-50' : ''}`}>
              <div className={`${rowGridClass} lg:items-center`}>
                <div className="flex min-w-0 items-center gap-4">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border bg-muted/40">
                    {imageUrl ? (
                      <Image src={imageUrl} alt={product.name} fill sizes="96px" className="object-cover" unoptimized={isLocalPreviewUrl} />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground/30"><Package className="h-7 w-7" /></div>
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-semibold text-foreground">{product.name}</p>
                    {brandLabel && <p className="truncate text-sm text-muted-foreground">{brandLabel}</p>}
                    {product.model_number && <p className="truncate text-xs text-muted-foreground">{product.model_number}</p>}
                  </div>
                </div>
                <div className="space-y-1.5 rounded-2xl bg-background/70 p-3 lg:bg-transparent lg:p-0">
                  <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground">分類</p>
                  <Select
                    value={product.category ?? ''}
                    onValueChange={(val) => setCategory.mutate({ id: product.id, category: val as ProductCategory })}
                  >
                    <SelectTrigger className="h-9 w-full text-xs">
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
                </div>
                <div className="rounded-2xl bg-background/70 p-3 lg:bg-transparent lg:p-0">
                  <p className="mb-1.5 text-xs font-medium tracking-[0.16em] text-muted-foreground">狀態</p>
                  {product.is_removed
                    ? <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground"><span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />已移除</span>
                    : <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground"><span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />正常</span>
                  }
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end">
                  <Button size="sm" variant="outline" className="min-w-20" onClick={() => setEditingProduct(product)}>編輯</Button>
                  {!product.is_removed && (
                    <>
                      <Dialog open={mergeId === product.id} onOpenChange={(open) => { if (!open) { setMergeId(null); setMergeTarget(null); setMergeSearch(''); setShowMergeList(false) } }}>
                        <DialogTrigger nativeButton render={<Button size="sm" variant="outline" className="min-w-20" onClick={() => setMergeId(product.id)} />}>
                          <GitMerge className="mr-1 h-3 w-3" />合併
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader><DialogTitle>合併商品</DialogTitle></DialogHeader>
                          <div className="space-y-3">
                            <p className="text-sm">將「{product.name}」的代購、許願、收藏轉移到：</p>
                            <div className="relative">
                              <Command className="rounded-lg border min-h-[200px]">
                                <CommandInput
                                  placeholder="搜尋目標商品..."
                                  value={mergeSearch}
                                  onValueChange={(v) => { setMergeSearch(v); setShowMergeList(true); if (!v) setMergeTarget(null) }}
                                />
                                {showMergeList && shouldTriggerSearch(mergeSearch) && (
                                  <CommandList className="max-h-48">
                                    <CommandEmpty>找不到商品</CommandEmpty>
                                    <CommandGroup>
                                      {mergeSearchResults?.filter(p => p.id !== product.id).map(p => (
                                        <CommandItem
                                          key={p.id}
                                          value={p.name}
                                          data-checked={mergeTarget === p.id}
                                          onSelect={() => { setMergeTarget(p.id); setMergeSearch(p.name); setShowMergeList(false) }}
                                        >
                                          <span className="truncate">{p.name}</span>
                                          {p.brand && <span className="ml-2 text-xs text-muted-foreground">{p.brand}</span>}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                )}
                              </Command>
                            </div>
                            {mergeTarget && (
                              <p className="text-sm text-muted-foreground">
                                目標：{mergeSearchResults?.find(p => p.id === mergeTarget)?.name}
                              </p>
                            )}
                            <Button
                              variant="destructive"
                              className="w-full"
                              onClick={() => mergeProduct.mutate({ sourceId: product.id, targetId: mergeTarget! })}
                              disabled={mergeProduct.isPending || !mergeTarget}
                            >
                              確認合併並移除「{product.name}」
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Dialog open={removeId === product.id} onOpenChange={(open) => { if (!open) setRemoveId(null) }}>
                        <DialogTrigger nativeButton render={<Button size="sm" variant="destructive" className="min-w-20" onClick={() => setRemoveId(product.id)} />}>
                          <Trash2 className="mr-1 h-3 w-3" />移除
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>移除商品</DialogTitle></DialogHeader>
                          <div className="space-y-3">
                            <p className="text-sm">確定要移除「{product.name}」？</p>
                            <div><Label>移除原因</Label><Textarea value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} placeholder="請填寫原因..." className="mt-1" /></div>
                            <Button variant="destructive" className="w-full" onClick={() => removeProduct.mutate({ id: product.id })} disabled={removeProduct.isPending || !removeReason.trim()}>確認移除</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <ProductEditDialog
        key={editingProduct?.id ?? 'closed'}
        product={editingProduct}
        open={!!editingProduct}
        onOpenChange={(open) => { if (!open) setEditingProduct(null) }}
        onSave={async (values: AdminProductEditValues) => { await updateProduct.mutateAsync(values) }}
        isPending={updateProduct.isPending}
      />
    </>
  )
}

// ─── Brands Tab ───────────────────────────────────────────────────────────────

function BrandsTab() {
  const utils = trpc.useUtils()
  const { data: brands, isLoading } = trpc.admin.todayBrands.useQuery()
  const { data: allBrands } = trpc.brand.list.useQuery()

  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [mergeId, setMergeId] = useState<string | null>(null)
  const [mergeTarget, setMergeTarget] = useState<string | null>(null)
  const [mergeSearch, setMergeSearch] = useState('')
  const [showMergeList, setShowMergeList] = useState(false)

  const invalidate = () => {
    utils.admin.todayBrands.invalidate()
    utils.brand.list.invalidate()
  }

  const renameBrand = trpc.admin.renameBrand.useMutation({
    onSuccess: () => { toast.success('已更名'); setRenameId(null); setRenameName(''); invalidate() },
    onError: (err) => toast.error(err.message),
  })
  const deleteBrand = trpc.admin.deleteBrand.useMutation({
    onSuccess: () => { toast.success('已刪除品牌'); setDeleteId(null); invalidate() },
    onError: (err) => toast.error(err.message),
  })
  const mergeBrand = trpc.admin.mergeBrand.useMutation({
    onSuccess: () => { toast.success('已合併品牌'); setMergeId(null); setMergeTarget(null); setMergeSearch(''); setShowMergeList(false); invalidate() },
    onError: (err) => toast.error(err.message),
  })

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
  if (!brands?.length) return <EmptyState icon={Tags} title="今天還沒有新增品牌" />

  return (
    <div className="space-y-2">
      {brands.map((brand) => (
        <div key={brand.id} className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium">{brand.name}</p>
            <p className="text-sm text-muted-foreground">{brand.productCount} 個商品</p>
          </div>
          <div className="flex gap-2">
            {/* Rename */}
            <Dialog open={renameId === brand.id} onOpenChange={(open) => { if (!open) { setRenameId(null); setRenameName('') } }}>
              <DialogTrigger nativeButton render={<Button size="sm" variant="outline" onClick={() => { setRenameId(brand.id); setRenameName(brand.name) }} />}>
                <Pencil className="mr-1 h-3 w-3" />改名
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>重新命名品牌</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>品牌名稱</Label><Input value={renameName} onChange={(e) => setRenameName(e.target.value)} className="mt-1" /></div>
                  <Button className="w-full" onClick={() => renameBrand.mutate({ id: brand.id, name: renameName })} disabled={renameBrand.isPending || !renameName.trim()}>儲存</Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Merge */}
            <Dialog open={mergeId === brand.id} onOpenChange={(open) => { if (!open) { setMergeId(null); setMergeTarget(null); setMergeSearch(''); setShowMergeList(false) } }}>
              <DialogTrigger nativeButton render={<Button size="sm" variant="outline" onClick={() => setMergeId(brand.id)} />}>
                <GitMerge className="mr-1 h-3 w-3" />合併
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>合併品牌</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm">將「{brand.name}」的所有商品轉移到：</p>
                  <div className="relative">
                    <Command className="rounded-lg border min-h-[200px]">
                      <CommandInput
                        placeholder="搜尋目標品牌..."
                        value={mergeSearch}
                        onValueChange={(v) => { setMergeSearch(v); setShowMergeList(true); if (!v) setMergeTarget(null) }}
                      />
                      {showMergeList && mergeSearch && (
                        <CommandList className="max-h-48">
                          <CommandEmpty>找不到品牌</CommandEmpty>
                          <CommandGroup>
                            {allBrands?.filter(b => b.id !== brand.id).map(b => (
                              <CommandItem
                                key={b.id}
                                value={b.name}
                                data-checked={mergeTarget === b.id}
                                onSelect={() => { setMergeTarget(b.id); setMergeSearch(b.name); setShowMergeList(false) }}
                              >
                                {b.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      )}
                    </Command>
                  </div>
                  {mergeTarget && (
                    <p className="text-sm text-muted-foreground">
                      目標：{allBrands?.find(b => b.id === mergeTarget)?.name}
                    </p>
                  )}
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => mergeBrand.mutate({ sourceId: brand.id, targetId: mergeTarget! })}
                    disabled={mergeBrand.isPending || !mergeTarget}
                  >
                    確認合併並刪除「{brand.name}」
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Delete */}
            <Dialog open={deleteId === brand.id} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
              <DialogTrigger nativeButton render={<Button size="sm" variant="destructive" onClick={() => setDeleteId(brand.id)} />}>
                <Trash2 className="mr-1 h-3 w-3" />刪除
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>刪除品牌</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm">確定要刪除「{brand.name}」？相關商品的品牌欄位將會清空。</p>
                  <Button variant="destructive" className="w-full" onClick={() => deleteBrand.mutate({ id: brand.id })} disabled={deleteBrand.isPending}>確認刪除</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Listings Tab ─────────────────────────────────────────────────────────────

function ListingsTab() {
  const utils = trpc.useUtils()
  const { data: listings, isLoading } = trpc.admin.todayListings.useQuery()
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [removeReason, setRemoveReason] = useState('')

  const approve = trpc.admin.approveListing.useMutation({
    onSuccess: () => { toast.success('已通過'); utils.admin.todayListings.invalidate() },
    onError: (err) => toast.error(err.message),
  })
  const remove = trpc.admin.removeListing.useMutation({
    onSuccess: () => { toast.success('已下架'); setRemoveId(null); setRemoveReason(''); utils.admin.todayListings.invalidate() },
    onError: (err) => toast.error(err.message),
  })

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
  if (!listings?.length) return <EmptyState icon={Package} title="今天還沒有新增代購" />

  return (
    <div className="space-y-4">
      {listings.map((listing: any) => (
        <div key={listing.id} className="rounded-2xl border bg-white p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,260px)_1fr]">
            <ProductCard
              product={{
                id: listing.product?.id ?? listing.id,
                name: listing.product?.name ?? '未知商品',
                brand: listing.product?.brand ?? null,
                model_number: listing.product?.model_number ?? null,
                catalog_image: listing.product?.catalog_image ?? null,
                product_images: listing.product?.product_images ?? [],
              }}
              linkToProduct={false}
            />
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  賣家：{listing.seller?.name ?? '未知'} · {formatDate(listing.created_at)}
                </p>
                {listing.note && <p className="text-sm">{listing.note}</p>}
              </div>
              <div className="flex gap-2">
                {listing.status === 'pending_approval' && (
                  <>
                    <Button size="sm" onClick={() => approve.mutate({ id: listing.id })} disabled={approve.isPending}>
                      <Check className="mr-1 h-3 w-3" />通過
                    </Button>
                    <Dialog open={removeId === listing.id} onOpenChange={(open) => { if (!open) { setRemoveId(null); setRemoveReason('') } }}>
                      <DialogTrigger nativeButton render={<Button size="sm" variant="destructive" onClick={() => setRemoveId(listing.id)} />}>
                        <X className="mr-1 h-3 w-3" />駁回
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>駁回代購</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div><Label>駁回原因</Label><Textarea value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} placeholder="請填寫原因..." className="mt-1" /></div>
                          <Button variant="destructive" className="w-full" onClick={() => remove.mutate({ id: listing.id, admin_note: removeReason })} disabled={remove.isPending || !removeReason.trim()}>確認駁回</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
                {listing.status === 'active' && (
                  <Dialog open={removeId === listing.id} onOpenChange={(open) => { if (!open) { setRemoveId(null); setRemoveReason('') } }}>
                    <DialogTrigger nativeButton render={<Button size="sm" variant="destructive" onClick={() => setRemoveId(listing.id)} />}>
                      <X className="mr-1 h-3 w-3" />下架
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>下架代購</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div><Label>下架原因</Label><Textarea value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} placeholder="請填寫原因..." className="mt-1" /></div>
                        <Button variant="destructive" className="w-full" onClick={() => remove.mutate({ id: listing.id, admin_note: removeReason })} disabled={remove.isPending || !removeReason.trim()}>確認下架</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                {(listing.status === 'draft' || listing.status === 'inactive') && (
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${listing.status === 'draft' ? 'bg-yellow-400' : 'bg-gray-400'}`} />
                    {listing.status === 'draft' ? '草稿' : '已下架'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Connections Tab ──────────────────────────────────────────────────────────

function ConnectionsTab() {
  const utils = trpc.useUtils()
  const { data: connections, isLoading } = trpc.admin.todayConnections.useQuery()
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [removeReason, setRemoveReason] = useState('')

  const approve = trpc.admin.approveConnection.useMutation({
    onSuccess: () => { toast.success('已通過'); utils.admin.todayConnections.invalidate() },
    onError: (err) => toast.error(err.message),
  })
  const remove = trpc.admin.removeConnection.useMutation({
    onSuccess: () => { toast.success('已結束'); setRemoveId(null); setRemoveReason(''); utils.admin.todayConnections.invalidate() },
    onError: (err) => toast.error(err.message),
  })

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
  if (!connections?.length) return <EmptyState icon={Globe} title="今天還沒有新增連線" />

  return (
    <div className="space-y-3">
      {connections.map((conn: any) => (
        <div key={conn.id} className="rounded-lg border p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium">
                {conn.region?.name}
                {conn.locations?.length > 0 ? ` - ${conn.locations.slice(0, 2).join('・')}${conn.locations.length > 2 ? ` +${conn.locations.length - 2}` : ''}` : ''}
              </p>
              <p className="text-sm text-muted-foreground">
                賣家：{conn.seller?.name ?? '未知'} · {formatDate(conn.start_date)} ~ {formatDate(conn.end_date)}
              </p>
              {conn.description && <p className="text-sm mt-1">{conn.description}</p>}
            </div>
            <div className="flex gap-2">
              {conn.status === 'pending_approval' && (
                <>
                  <Button size="sm" onClick={() => approve.mutate({ id: conn.id })} disabled={approve.isPending}>
                    <Check className="mr-1 h-3 w-3" />通過
                  </Button>
                  <Dialog open={removeId === conn.id} onOpenChange={(open) => { if (!open) { setRemoveId(null); setRemoveReason('') } }}>
                    <DialogTrigger nativeButton render={<Button size="sm" variant="destructive" onClick={() => setRemoveId(conn.id)} />}>
                      <X className="mr-1 h-3 w-3" />駁回
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>駁回連線</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div><Label>駁回原因</Label><Textarea value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} placeholder="請填寫原因..." className="mt-1" /></div>
                        <Button variant="destructive" className="w-full" onClick={() => remove.mutate({ id: conn.id, admin_note: removeReason })} disabled={remove.isPending || !removeReason.trim()}>確認駁回</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              )}
              {conn.status === 'active' && (
                <Dialog open={removeId === conn.id} onOpenChange={(open) => { if (!open) { setRemoveId(null); setRemoveReason('') } }}>
                  <DialogTrigger nativeButton render={<Button size="sm" variant="destructive" onClick={() => setRemoveId(conn.id)} />}>
                    <X className="mr-1 h-3 w-3" />結束
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>結束連線</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>結束原因</Label><Textarea value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} placeholder="請填寫原因..." className="mt-1" /></div>
                      <Button variant="destructive" className="w-full" onClick={() => remove.mutate({ id: conn.id, admin_note: removeReason })} disabled={remove.isPending || !removeReason.trim()}>確認結束</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              {conn.status === 'ended' && (
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-gray-400" />已結束
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminTodayPage() {
  const { data: products } = trpc.admin.todayProducts.useQuery()
  const { data: brands } = trpc.admin.todayBrands.useQuery()
  const { data: listings } = trpc.admin.todayListings.useQuery()
  const { data: connections } = trpc.admin.todayConnections.useQuery()

  const counts = {
    products: products?.length ?? 0,
    brands: brands?.length ?? 0,
    listings: listings?.length ?? 0,
    connections: connections?.length ?? 0,
  }

  const tabs = [
    { value: 'products', label: '商品' },
    { value: 'brands', label: '品牌' },
    { value: 'listings', label: '代購' },
    { value: 'connections', label: '連線' },
  ] as const

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">今日新增</h1>
      <Tabs defaultValue="products">
        <TabsList variant="line" className="flex-wrap w-full border-b border-border">
          {tabs.map(({ value, label }) => (
            <TabsTrigger key={value} value={value}>
              {label} ({counts[value]})
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="mt-6">
          <TabsContent value="products"><ProductsTab /></TabsContent>
          <TabsContent value="brands"><BrandsTab /></TabsContent>
          <TabsContent value="listings"><ListingsTab /></TabsContent>
          <TabsContent value="connections"><ConnectionsTab /></TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
