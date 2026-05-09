'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, Package, Check, X } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { ProductCard } from '@/components/product/product-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { ImageUpload, uploadImageFiles, type UploadedImage } from '@/components/shared/image-upload'
import { FormFieldError } from '@/components/shared/form-field-error'
import { buttonVariants } from '@/components/ui/button'
import { trpc } from '@/lib/trpc/client'
import { parseSafeHttpUrl } from '@/lib/utils/safe-url'
import { scrollToFirstError } from '@/lib/utils/scroll-to-error'
import { toast } from 'sonner'

const SPEC_TYPES = [
  { value: '顏色', label: '顏色', placeholder: '如：紅色、藍色、白色' },
  { value: '尺寸', label: '尺寸', placeholder: '如：S、M、L、XL' },
  { value: '口味', label: '口味', placeholder: '如：原味、草莓、巧克力' },
  { value: '容量', label: '容量', placeholder: '如：250ml、500ml、1L' },
  { value: '材質', label: '材質', placeholder: '如：棉、麻、聚酯纖維' },
  { value: '款式', label: '款式', placeholder: '如：經典款、限定款' },
  { value: '重量', label: '重量', placeholder: '如：100g、200g、500g' },
  { value: '自訂', label: '自訂', placeholder: '輸入選項後按 Enter' },
]

const SPEC_PLACEHOLDER: Record<string, string> = Object.fromEntries(
  SPEC_TYPES.map((t) => [t.value, t.placeholder])
)

interface SpecEntry {
  type: string
  is_custom: boolean
  options: string[]
  is_all: boolean
  _optionInput: string
}

function SpecTagInput({
  specType,
  options,
  inputValue,
  onInputChange,
  onAdd,
  onRemove,
  onRemoveLast,
}: {
  specType: string
  options: string[]
  inputValue: string
  onInputChange: (val: string) => void
  onAdd: () => void
  onRemove: (index: number) => void
  onRemoveLast: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const placeholder = options.length === 0
    ? (SPEC_PLACEHOLDER[specType] ?? '輸入後按 Enter，留空為該規格皆有')
    : '輸入後按 Enter…'
  return (
    <div
      className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1 cursor-text focus-within:ring-1 focus-within:ring-ring"
      onClick={() => inputRef.current?.focus()}
    >
      {options.map((opt, i) => (
        <span key={i} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
          {opt}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(i) }}
            className="text-muted-foreground hover:text-destructive leading-none"
            aria-label={`移除 ${opt}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return
          if (e.key === 'Enter') {
            e.preventDefault()
            onAdd()
          } else if (e.key === 'Backspace' && !inputValue) {
            onRemoveLast()
          }
        }}
        placeholder={placeholder}
        className="min-w-[80px] flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/70 py-0.5"
      />
    </div>
  )
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
  const selectedProductImageUrl = initialData?.product?.catalog_image?.thumbnail_url
    ?? initialData?.product?.catalog_image?.url
    ?? initialData?.product?.product_images?.[0]?.thumbnail_url
    ?? initialData?.product?.product_images?.[0]?.url
    ?? null
  const selectedProductBrandLabel = typeof initialData?.product?.brand === 'string'
    ? initialData.product.brand
    : initialData?.product?.brand?.name ?? null

  const [title, setTitle] = useState(initialData?.title ?? '')
  const [price, setPrice] = useState<string>(initialData?.price?.toString() ?? '')
  const [isPriceOnRequest, setIsPriceOnRequest] = useState(initialData?.is_price_on_request ?? false)
  const [isInStock, setIsInStock] = useState(initialData?.is_in_stock ?? false)
  const [specs, setSpecs] = useState<SpecEntry[]>(
    initialData?.specs?.map((s: any) => ({ ...s, _optionInput: '' })) ?? []
  )
  const [note, setNote] = useState(initialData?.note ?? '')
  const [postUrl, setPostUrl] = useState(initialData?.post_url ?? '')
  const [shippingDate, setShippingDate] = useState<string>(initialData?.shipping_date?.split('T')[0] ?? '')
  const [expiresAt, setExpiresAt] = useState(initialData?.expires_at?.split('T')[0] ?? '')
  const [images, setImages] = useState<UploadedImage[]>(
    (initialData?.images ?? initialData?.listing_images ?? []).map((img: any) => ({
      url: img.url ?? img.image_url,
      r2Key: img.r2_key ?? img.r2Key,
      thumbnailUrl: img.thumbnail_url ?? img.thumbnailUrl ?? img.url ?? img.image_url,
      thumbnailR2Key: img.thumbnail_r2_key ?? img.thumbnailR2Key ?? img.r2_key ?? img.r2Key,
    })) ?? []
  )
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingUrl, setIsCheckingUrl] = useState(false)
  const [isPreparingImages, setIsPreparingImages] = useState(false)
  const [postUrlSafe, setPostUrlSafe] = useState<boolean | null>(null)
  const [errors, setErrors] = useState<{ title?: string; price?: string; shippingDate?: string; postUrl?: string; images?: string }>({})
  const isCheckingUrlRef = useRef(false)
  const isPreparingImagesRef = useRef(false)

  const checkPostUrl = trpc.listing.checkPostUrl.useMutation()
  const createListing = trpc.listing.create.useMutation()
  const updateListing = trpc.listing.update.useMutation()
  const publishListing = trpc.listing.publish.useMutation()
  const deleteListing = trpc.listing.delete.useMutation()
  const confirmImages = trpc.upload.confirmListingImages.useMutation()
  const deleteObjects = trpc.upload.deleteObjects.useMutation()
  const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation()

  const clearError = (field: keyof typeof errors) => {
    setErrors((current) => {
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handlePostUrlBlur = async () => {
    const trimmed = postUrl.trim()
    if (!trimmed) return

    if (!parseSafeHttpUrl(trimmed)) {
      setPostUrlSafe(false)
      setErrors((current) => ({ ...current, postUrl: '請提供有效的貼文連結' }))
      return
    }

    isCheckingUrlRef.current = true
    setIsCheckingUrl(true)
    try {
      const result = await checkPostUrl.mutateAsync({ url: trimmed })
      if (!result.safe) {
        setPostUrlSafe(false)
        setErrors((current) => ({
          ...current,
          postUrl: `此連結被 Google 標記為${result.threat}，請改用其他連結`,
        }))
      } else {
        setPostUrlSafe(true)
      }
    } catch {
      // API 失敗時不阻擋用戶
    } finally {
      isCheckingUrlRef.current = false
      setIsCheckingUrl(false)
    }
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
    const specsClean = specs.map(({ _optionInput, options, ...rest }) => ({
      ...rest,
      options,
      is_all: options.length === 0,
    }))
    return {
      product_id: resolvedProductId,
      title: title.trim(),
      status,
      price: price ? Number(price) : undefined,
      is_price_on_request: isPriceOnRequest,
      is_in_stock: isInStock,
      specs: specsClean,
      note: note || undefined,
      post_url: postUrl || undefined,
      shipping_date: shippingDate || undefined,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    }
  }

  const handleSave = async (status: 'draft' | 'active') => {
    if (isCheckingUrlRef.current || isPreparingImagesRef.current) {
      return
    }

    if (status === 'draft') {
      const isFormEmpty = !title.trim() && !price.trim() && !isPriceOnRequest && specs.length === 0 && !note.trim() && !postUrl.trim() && !shippingDate && !expiresAt && images.length === 0 && pendingFiles.length === 0
      if (isFormEmpty) {
        router.push('/dashboard/listings')
        return
      }
    }

    if (status === 'active') {
      const nextErrors: { title?: string; price?: string; shippingDate?: string; postUrl?: string; specs?: string; images?: string } = {}
      const trimmedPostUrl = postUrl.trim()
      const trimmedPrice = price.trim()

      if (!title.trim()) {
        nextErrors.title = '標題為必填'
      }

      if (!trimmedPostUrl) {
        nextErrors.postUrl = '貼文連結為必填'
      } else if (!parseSafeHttpUrl(trimmedPostUrl)) {
        nextErrors.postUrl = '請提供有效的貼文連結'
      }

      if (!shippingDate) {
        nextErrors.shippingDate = '出貨日期為必填'
      }

      if (!isPriceOnRequest) {
        if (!trimmedPrice) {
          nextErrors.price = '價格為必填'
        } else if (Number(trimmedPrice) < 1) {
          nextErrors.price = '價格不得為0或負數'
        }
      }

      if (images.length + pendingFiles.length === 0) {
        nextErrors.images = '至少需要一張圖片'
      }

      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors)
        scrollToFirstError()
        return
      }

      setErrors({})
    }

    setIsSubmitting(true)
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
          const uploadedImages = await uploadImageFiles('listing', pendingFiles, getPresignedUrl.mutateAsync)
          uploadedR2Keys.push(...uploadedImages.flatMap((img) => [img.r2Key, img.thumbnailR2Key].filter(Boolean) as string[]))
          const allImages = [...images, ...uploadedImages]
          // ── Step 3: Confirm image relations in DB (atomic via RPC) ──
          await confirmImages.mutateAsync({
            listing_id: result.id,
            images: allImages.map((img, i) => ({
              r2_key: img.r2Key,
              url: img.url,
              thumbnail_r2_key: img.thumbnailR2Key ?? img.r2Key,
              thumbnail_url: img.thumbnailUrl ?? img.url,
              sort_order: i,
            })),
          })
        } else if (images.length > 0) {
          await confirmImages.mutateAsync({
            listing_id: result.id,
            images: images.map((img, i) => ({
              r2_key: img.r2Key,
              url: img.url,
              thumbnail_r2_key: img.thumbnailR2Key ?? img.r2Key,
              thumbnail_url: img.thumbnailUrl ?? img.url,
              sort_order: i,
            })),
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
          ? await uploadImageFiles('listing', pendingFiles, getPresignedUrl.mutateAsync)
          : []
        const allImages = [...images, ...uploadedImages]
        const { product_id: _, status: __, ...updateData } = buildInput(status, productId ?? initialData.product_id)
        await updateListing.mutateAsync({ id: initialData.id, ...updateData, shipping_date: shippingDate || null })
        await confirmImages.mutateAsync({
          listing_id: initialData.id,
          images: allImages.map((img, i) => ({
            r2_key: img.r2Key,
            url: img.url,
            thumbnail_r2_key: img.thumbnailR2Key ?? img.r2Key,
            thumbnail_url: img.thumbnailUrl ?? img.url,
            sort_order: i,
          })),
        })
        toast.dismiss(toastId)
        toast.success('\u5df2\u66f4\u65b0')
      }

      utils.listing.myListings.invalidate()
      utils.listing.myListingCount.invalidate()
      if (mode === 'edit' && initialData?.id) {
        utils.listing.getById.invalidate({ id: initialData.id })
      }
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
      setIsSubmitting(false)
    }
  }

  const isPending = isSubmitting || createListing.isPending || updateListing.isPending || publishListing.isPending
  const isSubmitDisabled = isPending || isCheckingUrl || isPreparingImages

  return (
    <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); handleSave('active') }} noValidate>
      {/* Title */}
      <div>
        <Label htmlFor="listing-title">標題 *</Label>
        <Input
          id="listing-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            if (errors.title) clearError('title')
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
          placeholder="輸入標題"
          maxLength={30}
          className="mt-1"
          aria-invalid={!!errors.title}
        />
        <FormFieldError message={errors.title} />
      </div>

      {mode === 'edit' && initialData?.product && (
        <div>
          <Label>商品</Label>
          <ProductCard
            product={{
              id: initialData.product.id,
              name: initialData.product.name,
              brand: selectedProductBrandLabel,
              model_number: initialData.product.model_number,
              catalog_image_url: selectedProductImageUrl,
            }}
            linkToProduct={false}
            variant="compact"
            className="mt-1 w-fit"
          />
        </div>
      )}

      {/* Images */}
      <div>
        <Label>
          商品圖片 *
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">{images.length + pendingFiles.length} / 5</span>
        </Label>
        <ImageUpload
          purpose="listing"
          maxImages={5}
          images={images}
          invalid={!!errors.images}
          onUploadingChange={(uploading) => {
            isPreparingImagesRef.current = uploading
            setIsPreparingImages(uploading)
          }}
          onChange={(value) => {
            setImages(value)
            if (errors.images) clearError('images')
          }}
          pendingFiles={pendingFiles}
          onPendingFilesChange={(value) => {
            setPendingFiles(value)
            if (errors.images) clearError('images')
          }}
          className="mt-1"
        />
        <FormFieldError message={errors.images} />
      </div>

      {/* Price */}
      <div>
        <Label htmlFor="price">價格 (NT$) *</Label>
        {!isPriceOnRequest && (
          <>
            <Input
              id="price"
              type="number"
              min="0"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value)
                if (errors.price) clearError('price')
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
              placeholder="輸入價格"
              className="mt-1"
              aria-invalid={!!errors.price}
            />
            <FormFieldError message={errors.price} />
          </>
        )}
      </div>

      {/* Shipping */}
      <div>
        <Label>預計出貨日期 *</Label>
        <DatePicker
          value={shippingDate}
          onValueChange={(value) => {
            setShippingDate(value)
            if (errors.shippingDate) clearError('shippingDate')
          }}
          placeholder="選擇預計出貨日期"
          className="mt-1"
          minDate={new Date()}
          invalid={!!errors.shippingDate}
        />
        <FormFieldError message={errors.shippingDate} />
      </div>

      {/* In Stock */}
      <div className="flex items-center gap-2">
        <Switch
          id="is-in-stock"
          checked={isInStock}
          onCheckedChange={setIsInStock}
        />
        <Label htmlFor="is-in-stock" className="cursor-pointer">有現貨</Label>
      </div>

      {/* Specs */}
      <div>
        <Label className="mb-2 block">規格</Label>
        {specs.length > 0 && (
          <div className="mb-2">
            <div className="grid gap-1.5 mb-1 px-0.5" style={{ gridTemplateColumns: '100px 1fr 32px' }}>
              <span className="text-xs text-muted-foreground">規格</span>
              <span className="text-xs text-muted-foreground">選項 <span className="font-normal">（空白為該規格皆有）</span></span>
              <span />
            </div>
            {specs.map((spec, index) => {
              const usedTypes = new Set(
                specs.filter((_, i) => i !== index && !specs[i].is_custom).map((s) => s.type)
              )
              return (
              <div key={index} className="grid gap-1.5 mb-2 items-start" style={{ gridTemplateColumns: '100px 1fr 32px' }}>
                {spec.is_custom && spec.type !== '自訂' ? (
                  <Input
                    value={spec.type}
                    onChange={(e) => updateSpec(index, { type: e.target.value })}
                    onBlur={() => { if (!spec.type.trim()) updateSpec(index, { type: '顏色', is_custom: false }) }}
                    placeholder="自訂名稱"
                    className="h-9 text-sm"
                  />
                ) : (
                  <Select
                    value={spec.is_custom ? '自訂' : spec.type}
                    onValueChange={(val) => {
                      if (!val) return
                      if (val === '自訂') {
                        updateSpec(index, { type: '', is_custom: true })
                      } else {
                        updateSpec(index, { type: val, is_custom: false })
                      }
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SPEC_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value} disabled={usedTypes.has(t.value)}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <SpecTagInput
                  specType={spec.is_custom ? '自訂' : spec.type}
                  options={spec.options}
                  inputValue={spec._optionInput}
                  onInputChange={(val) => updateSpec(index, { _optionInput: val })}
                  onAdd={() => addOption(index)}
                  onRemove={(oi) => removeOption(index, oi)}
                  onRemoveLast={() => { if (spec.options.length > 0) removeOption(index, spec.options.length - 1) }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSpec(index)}
                  className="h-9 w-8 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              )
            })}
          </div>
        )}
        <Button type="button" variant="outline" size="sm" onClick={addSpec} className="w-full border-dashed">
          <Plus className="mr-1 h-3 w-3" />新增規格
        </Button>
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
        <Label htmlFor="postUrl">貼文連結 *</Label>
        <div className="relative mt-1">
          <Input
            id="postUrl"
            type="url"
            value={postUrl}
            onChange={(e) => {
              setPostUrl(e.target.value)
              setPostUrlSafe(null)
              if (errors.postUrl) clearError('postUrl')
            }}
            onBlur={handlePostUrlBlur}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
              }
            }}
            placeholder="https://www.instagram.com/p/..."
            className="pr-16"
            aria-invalid={!!errors.postUrl}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs">
            {isCheckingUrl ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : postUrlSafe === true ? (
              <><Check className="h-3.5 w-3.5 text-green-600" /><span className="text-green-600">安全</span></>
            ) : postUrlSafe === false ? (
              <X className="h-3.5 w-3.5 text-destructive" />
            ) : null}
          </span>
        </div>
        {isCheckingUrl
          ? <p className="mt-1 text-xs text-muted-foreground">正在檢查連結安全性...</p>
          : <FormFieldError message={errors.postUrl} />}
      </div>

      {/* Expires */}
      <div>
        <Label>截止日期</Label>
        <DatePicker
          value={expiresAt}
          onValueChange={setExpiresAt}
          placeholder="選擇截止日期"
          className="mt-1"
          minDate={new Date()}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={() => handleSave('draft')} disabled={isSubmitDisabled}>
          {isSubmitDisabled ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          {mode === 'edit' ? '儲存變更' : '儲存代購'}
        </Button>
        <button type="submit" disabled={isSubmitDisabled} className={buttonVariants({ className: 'flex-1' })}>
          {isSubmitDisabled ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          {mode === 'create' ? '直接上架' : '更新代購'}
        </button>
      </div>
    </form>
  )
}
