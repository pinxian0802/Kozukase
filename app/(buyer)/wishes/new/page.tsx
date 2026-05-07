'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ProductForm, type ProductFormData } from '@/components/product/product-form'
import { uploadImageFiles } from '@/components/shared/image-upload'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'

export default function WishNewPage() {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingProduct, setPendingProduct] = useState<{ id: string; name: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const createdProductIdRef = useRef<string | null>(null)

  const createProduct = trpc.product.create.useMutation()
  const createBrand = trpc.brand.create.useMutation()
  const wishToggle = trpc.wish.toggle.useMutation()
  const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation()
  const confirmProductImage = trpc.upload.confirmProductImage.useMutation()
  const deleteObjects = trpc.upload.deleteObjects.useMutation()

  const handleFormContinue = async (data: ProductFormData) => {
    setIsSubmitting(true)

    try {
      let productId = createdProductIdRef.current

      if (!productId) {
        let resolvedBrandId = data.brand_id
        if (resolvedBrandId?.startsWith('__new__:')) {
          const brand = await createBrand.mutateAsync({ name: resolvedBrandId.slice(8) })
          resolvedBrandId = brand.id
        }

        const product = await createProduct.mutateAsync({
          name: data.name,
          brand_id: resolvedBrandId || undefined,
          model_number: data.modelNumber.trim() || undefined,
          category: data.category || undefined,
          region_id: data.regionId || undefined,
        })
        productId = product.id as string
        createdProductIdRef.current = productId

        if (data.pendingFile) {
          const uploaded = await uploadImageFiles('product', [data.pendingFile], getPresignedUrl.mutateAsync)
          if (uploaded[0]) {
            try {
              await confirmProductImage.mutateAsync({
                product_id: productId,
                r2_key: uploaded[0].r2Key,
                url: uploaded[0].url,
                thumbnail_r2_key: uploaded[0].thumbnailR2Key ?? uploaded[0].r2Key,
                thumbnail_url: uploaded[0].thumbnailUrl ?? uploaded[0].url,
              })
            } catch {
              await deleteObjects.mutateAsync({
                r2Keys: [uploaded[0].r2Key, uploaded[0].thumbnailR2Key].filter(Boolean) as string[],
              }).catch(() => {})
              throw new Error('圖片上傳失敗，請重試')
            }
          }
        }
      }

      setPendingProduct({ id: productId!, name: data.name })
      setConfirmOpen(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '新增商品失敗'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleWishConfirm = async () => {
    if (!pendingProduct) return
    try {
      await wishToggle.mutateAsync({ product_id: pendingProduct.id })
      toast.success('已加入許願清單')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '加入許願清單失敗'
      toast.error(message)
    } finally {
      setConfirmOpen(false)
      router.push('/wishes')
    }
  }

  const handleWishDecline = () => {
    toast.success('商品已新增到目錄')
    setConfirmOpen(false)
    router.push('/wishes')
  }

  return (
    <div className="mx-auto max-w-2xl">
      <ProductForm
        initialName=""
        onBack={() => router.back()}
        onContinue={handleFormContinue}
        isSubmitting={isSubmitting}
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={false} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>加入許願清單</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            要把「{pendingProduct?.name}」加入你的許願清單嗎？
          </p>
          <p className="text-xs text-muted-foreground">
            許願後，若有人上架代購此商品，系統會通知你。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={handleWishDecline}>
              不要
            </Button>
            <Button onClick={handleWishConfirm} disabled={wishToggle.isPending}>
              {wishToggle.isPending ? '處理中...' : '要'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
