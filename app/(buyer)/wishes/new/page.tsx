'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { WishForm, type WishFormData } from '@/components/buyer/wish-form'
import { uploadImageFiles } from '@/components/shared/image-upload'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'

export default function WishNewPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const createdProductIdRef = useRef<string | null>(null)

  const createProduct = trpc.product.create.useMutation()
  const createBrand = trpc.brand.create.useMutation()
  const wishCreate = trpc.wish.create.useMutation()
  const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation()
  const confirmProductImage = trpc.upload.confirmProductImage.useMutation()
  const deleteObjects = trpc.upload.deleteObjects.useMutation()

  const handleSubmit = async (data: WishFormData) => {
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

      await wishCreate.mutateAsync({
        product_id: productId!,
        content: data.content,
      })

      toast.success('許願已送出')
      router.push('/wishes')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '送出失敗，請重試'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <WishForm
        onBack={() => router.back()}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
