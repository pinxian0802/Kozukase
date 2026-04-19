'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ImageUpload, uploadImageFiles } from '@/components/shared/image-upload'
import { FormFieldError } from '@/components/shared/form-field-error'
import { buttonVariants } from '@/components/ui/button'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'

const SPEC_TYPES = [
  { value: '顏色', label: '顏色' },
  { value: '尺寸', label: '尺寸' },
  { value: '口味', label: '口味' },
  { value: '容量', label: '容量' },
  { value: '材質', label: '材質' },
  { value: '款式', label: '款式' },
  { value: '重量', label: '重量' },
  { value: '自訂', label: '自訂' },
]

interface SpecEntry {
  type: string
  is_custom: boolean
  options: string[]
  is_all: boolean
  _optionInput: string
}

interface ListingFormProps {
  productId?: string
  mode: 'create' | 'edit'
  initialData?: any
  onCreateProduct?: () => Promise<string>
}

export function ListingForm({ productId, mode, initialData, onCreateProduct }: ListingFormProps) {
  const router = useRouter()
  const utils = trpc.useUtils()
  const selectedProductImageUrl = initialData?.product?.catalog_image?.url ?? initialData?.product?.product_images?.[0]?.url ?? null

  const [price, setPrice] = useState<string>(initialData?.price?.toString() ?? '')
  const [isPriceOnRequest, setIsPriceOnRequest] = useState(initialData?.is_price_on_request ?? false)
  const [specs, setSpecs] = useState<SpecEntry[]>(
    initialData?.specs?.map((s: any) => ({ ...s, _optionInput: '' })) ?? []
  )
  const [note, setNote] = useState(initialData?.note ?? '')
  const [postUrl, setPostUrl] = useState(initialData?.post_url ?? '')
  const [shippingDays, setShippingDays] = useState<string>(initialData?.shipping_days?.toString() ?? '')
  const [expiresAt, setExpiresAt] = useState(initialData?.expires_at?.split('T')[0] ?? '')
  const [images, setImages] = useState<{ url: string; r2Key: string }[]>(
    (initialData?.images ?? initialData?.listing_images ?? []).map((img: any) => ({
      url: img.url ?? img.image_url,
      r2Key: img.r2_key ?? img.r2Key,
    })) ?? []
  )
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isCreatingProduct, setIsCreatingProduct] = useState(false)
  const [errors, setErrors] = useState<{ price?: string; shippingDays?: string; postUrl?: string }>({})

  const createListing = trpc.listing.create.useMutation()
  const updateListing = trpc.listing.update.useMutation()
  const publishListing = trpc.listing.publish.useMutation()
  const deleteListing = trpc.listing.delete.useMutation()
  const confirmImages = trpc.upload.confirmListingImages.useMutation()
  const deleteObjects = trpc.upload.deleteObjects.useMutation()

  const clearError = (field: keyof typeof errors) => {
    setErrors((current) => {
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const addSpec = () => {
    setSpecs([...specs, { type: '顏色', is_custom: false, options: [], is_all: false, _optionInput: '' }])
  }

  const removeSpec = (index: number) => {
    setSpecs(specs.filter((_, i) => i !== index))
  }

  const updateSpec = (index: number, updates: Partial<SpecEntry>) => {
    setSpecs(specs.map((s, i) => i === index ? { ...s, ...updates } : s))
  }

  const addOption = (index: number) => {
    const spec = specs[index]
    if (!spec._optionInput.trim()) return
    updateSpec(index, {
      options: [...spec.options, spec._optionInput.trim()],
      _optionInput: '',
    })
  }

  const removeOption = (specIndex: number, optionIndex: number) => {
    const spec = specs[specIndex]
    updateSpec(specIndex, {
      options: spec.options.filter((_, i) => i !== optionIndex),
    })
  }

  const buildInput = (status: 'draft' | 'active', resolvedProductId: string) => {
    const specsClean = specs.map(({ _optionInput, ...rest }) => rest)
    return {
      product_id: resolvedProductId,
      status,
      price: price ? Number(price) : undefined,
      is_price_on_request: isPriceOnRequest,
      specs: specsClean,
      note: note || undefined,
      post_url: postUrl || undefined,
      shipping_days: shippingDays ? Number(shippingDays) : undefined,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    }
  }

  const handleSave = async (status: 'draft' | 'active') => {
    if (status === 'active') {
      const nextErrors: { price?: string; shippingDays?: string; postUrl?: string } = {}
      const trimmedPostUrl = postUrl.trim()
      const trimmedPrice = price.trim()
      const trimmedShippingDays = shippingDays.trim()

      if (!trimmedPostUrl) {
        nextErrors.postUrl = '貼文連結為必填'
      } else {
        try {
          new URL(trimmedPostUrl)
        } catch {
          nextErrors.postUrl = '請提供有效的貼文連結'
        }
      }

      if (!trimmedShippingDays) {
        nextErrors.shippingDays = '出貨天數為必填'
      } else if (Number(trimmedShippingDays) < 1) {
        nextErrors.shippingDays = '出貨天數至少為 1 天'
      }

      if (!isPriceOnRequest) {
        if (!trimmedPrice) {
          nextErrors.price = '價格為必填'
        } else if (Number(trimmedPrice) < 0) {
          nextErrors.price = '價格不可小於 0'
        }
      }

      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors)
        return
      }

      setErrors({})
    }

    const toastId = toast.loading('\u8655\u7406\u4e2d...')

    // Track what was created so we can roll back on failure
    let createdListingId: string | null = null
    const uploadedR2Keys: string[] = []

    try {
      let resolvedProductId = productId
      if (mode === 'create' && !resolvedProductId) {
        if (!onCreateProduct) {
          throw new Error('\u7f3a\u5c11\u5546\u54c1\u5efa\u7acb\u6d41\u7a0b')
        }
        setIsCreatingProduct(true)
        resolvedProductId = await onCreateProduct()
        if (!resolvedProductId) {
          throw new Error('\u5546\u54c1\u5efa\u7acb\u5931\u6557')
        }
      }

      if (mode === 'create') {
        // ── Step 1: Create listing as draft (no notification side-effects yet) ──
        const result = await createListing.mutateAsync(buildInput('draft', resolvedProductId ?? ''))
        createdListingId = result.id

        // ── Step 2: Upload pending images to R2, collect keys for rollback ──
        if (pendingFiles.length > 0) {
          const uploadedImages = await uploadImageFiles('listing', pendingFiles)
          uploadedR2Keys.push(...uploadedImages.map(img => img.r2Key))
          const allImages = [...images, ...uploadedImages]
          // ── Step 3: Confirm image relations in DB (atomic via RPC) ──
          await confirmImages.mutateAsync({
            listing_id: result.id,
            images: allImages.map((img, i) => ({ r2_key: img.r2Key, url: img.url, sort_order: i })),
          })
        } else if (images.length > 0) {
          await confirmImages.mutateAsync({
            listing_id: result.id,
            images: images.map((img, i) => ({ r2_key: img.r2Key, url: img.url, sort_order: i })),
          })
        }

        // ── Step 4: Publish (active status + notifications) only after all ──
        // ──         image steps succeeded                                   ──
        if (status === 'active') {
          await publishListing.mutateAsync({ id: result.id })
        }

        toast.dismiss(toastId)
        toast.success(status === 'draft' ? '\u5df2\u5132\u5b58\u8349\u7a3f' : '\u5df2\u4e0a\u67b6')
      } else {
        // ── Edit flow: order unchanged (update data → upload → confirm) ──
        const uploadedImages = pendingFiles.length > 0
          ? await uploadImageFiles('listing', pendingFiles)
          : []
        const allImages = [...images, ...uploadedImages]
        const { product_id: _, status: __, ...updateData } = buildInput(status, productId ?? initialData.product_id)
        await updateListing.mutateAsync({ id: initialData.id, ...updateData })
        await confirmImages.mutateAsync({
          listing_id: initialData.id,
          images: allImages.map((img, i) => ({ r2_key: img.r2Key, url: img.url, sort_order: i })),
        })
        toast.dismiss(toastId)
        toast.success('\u5df2\u66f4\u65b0')
      }

      utils.listing.myListings.invalidate()
      utils.listing.myListingCount.invalidate()
      router.push('/dashboard/listings')
    } catch (err: any) {
      // ── Compensating rollback (create mode only) ─────────────────────────
      // Clean up any R2 objects that were successfully uploaded before the
      // failure, then delete the draft listing if it was inserted.
      if (mode === 'create') {
        if (uploadedR2Keys.length > 0) {
          await deleteObjects.mutateAsync({ r2Keys: uploadedR2Keys }).catch(() => {})
        }
        if (createdListingId) {
          await deleteListing.mutateAsync({ id: createdListingId }).catch(() => {})
        }
      }
      toast.dismiss(toastId)
      toast.error(err.message ?? '\u64cd\u4f5c\u5931\u6557')
    } finally {
      setIsCreatingProduct(false)
    }
  }

  const isPending = createListing.isPending || updateListing.isPending || isCreatingProduct || publishListing.isPending

  return (
    <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); handleSave('active') }} noValidate>
      {mode === 'edit' && initialData?.product && (
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
            {selectedProductImageUrl ? (
              <img
                src={selectedProductImageUrl}
                alt={initialData.product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Package className="h-6 w-6 text-muted-foreground/40" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{initialData.product.name}</p>
            {initialData.product.brand && (
              <p className="truncate text-xs text-muted-foreground">{initialData.product.brand}</p>
            )}
          </div>
        </div>
      )}

      {/* Images */}
      <div>
        <Label>{mode === 'edit' ? '商品圖片（可修改）' : '商品圖片（最多 5 張）'}</Label>
        <ImageUpload
          purpose="listing"
          maxImages={5}
          images={images}
          onChange={setImages}
          pendingFiles={pendingFiles}
          onPendingFilesChange={setPendingFiles}
          className="mt-2"
        />
      </div>

      {/* Price */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="price">價格 (NT$)</Label>
          <div className="flex items-center gap-2">
            <Switch
              id="priceOnRequest"
              checked={isPriceOnRequest}
              onCheckedChange={(checked) => {
                setIsPriceOnRequest(checked)
                if (checked && errors.price) clearError('price')
              }}
            />
            <Label htmlFor="priceOnRequest" className="text-sm">私訊報價</Label>
          </div>
        </div>
        {!isPriceOnRequest && (
          <div>
            <Input
              id="price"
              type="number"
              min="0"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value)
                if (errors.price) clearError('price')
              }}
              placeholder="輸入價格"
              aria-invalid={!!errors.price}
            />
            <FormFieldError message={errors.price} />
          </div>
        )}
      </div>

      {/* Shipping */}
      <div>
        <Label htmlFor="shipping">出貨天數</Label>
        <Input
          id="shipping"
          type="number"
          min="1"
          value={shippingDays}
          onChange={(e) => {
            setShippingDays(e.target.value)
            if (errors.shippingDays) clearError('shippingDays')
          }}
          placeholder="預計出貨天數"
          className="mt-1"
          aria-invalid={!!errors.shippingDays}
        />
        <FormFieldError message={errors.shippingDays} />
      </div>

      {/* Specs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>規格</Label>
          <Button type="button" variant="outline" size="sm" onClick={addSpec}>
            <Plus className="mr-1 h-3 w-3" />新增規格
          </Button>
        </div>
        {specs.map((spec, index) => (
          <div key={index} className="mb-4 rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Select
                value={spec.type}
                onValueChange={(val) => val && updateSpec(index, {
                  type: val,
                  is_custom: val === '自訂',
                })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPEC_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {spec.is_custom && (
                <Input
                  value={spec.type === '自訂' ? '' : spec.type}
                  onChange={(e) => updateSpec(index, { type: e.target.value })}
                  placeholder="自訂規格名"
                  className="flex-1"
                />
              )}
              <Button type="button" variant="ghost" size="icon" onClick={() => removeSpec(index)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id={`is_all_${index}`}
                checked={spec.is_all}
                onCheckedChange={(checked) => updateSpec(index, { is_all: !!checked })}
              />
              <Label htmlFor={`is_all_${index}`} className="text-sm">都有（全部選項）</Label>
            </div>

            {!spec.is_all && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={spec._optionInput}
                    onChange={(e) => updateSpec(index, { _optionInput: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption(index))}
                    placeholder="輸入選項，按 Enter 新增"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => addOption(index)}>新增</Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {spec.options.map((opt, oi) => (
                    <Badge key={oi} variant="secondary" className="gap-1">
                      {opt}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeOption(index, oi)}
                        className="h-4 w-4 p-0 text-muted-foreground hover:text-destructive"
                        aria-label={`移除選項 ${opt}`}
                      >
                        ×
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Note */}
      <div>
        <Label htmlFor="note">備註</Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="補充說明..."
          maxLength={1000}
          className="mt-1"
        />
      </div>

      {/* Post URL */}
      <div>
        <Label htmlFor="postUrl">貼文連結</Label>
        <Input
          id="postUrl"
          type="url"
          value={postUrl}
          onChange={(e) => {
            setPostUrl(e.target.value)
            if (errors.postUrl) clearError('postUrl')
          }}
          placeholder="https://www.instagram.com/p/..."
          className="mt-1"
          aria-invalid={!!errors.postUrl}
        />
        <FormFieldError message={errors.postUrl} />
      </div>

      {/* Expires */}
      <div>
        <Label htmlFor="expires">截止日期（選填）</Label>
        <Input
          id="expires"
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="mt-1"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={() => handleSave('draft')} disabled={isPending}>
          {isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          {mode === 'edit' ? '儲存變更' : '儲存代購'}
        </Button>
        <button type="submit" disabled={isPending} className={buttonVariants({ className: 'flex-1' })}>
          {isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          {mode === 'create' ? '直接上架' : '更新代購'}
        </button>
      </div>
    </form>
  )
}
