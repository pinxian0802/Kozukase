'use client'

import { useRef } from 'react'
import { trpc } from '@/lib/trpc/client'
import { uploadImageFiles } from '@/components/shared/image-upload'
import type { ProductFormData } from '@/components/product/product-form'

/**
 * Encapsulates "create a product lazily at listing-submit time".
 * The product is only written to the DB when `createProductForListing` is
 * called, avoiding orphan products if the user abandons the flow.
 */
export function useDeferredProductCreate() {
  // Cache the product id after it's been created in DB so retries after a
  // partial failure reuse it instead of creating a duplicate.
  const createdProductIdRef = useRef<string | null>(null)
  // Stores the product form data until createProductForListing reads it.
  const draftProductRef = useRef<ProductFormData | null>(null)

  const confirmProductImage = trpc.upload.confirmProductImage.useMutation()
  const createProduct = trpc.product.create.useMutation()
  const createBrand = trpc.brand.create.useMutation()
  const deleteObjects = trpc.upload.deleteObjects.useMutation()
  const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation()

  const setDraft = (data: ProductFormData) => {
    createdProductIdRef.current = null
    draftProductRef.current = data
  }

  const reset = () => {
    createdProductIdRef.current = null
    draftProductRef.current = null
  }

  const createProductForListing = async (): Promise<string> => {
    if (createdProductIdRef.current) {
      return createdProductIdRef.current
    }

    const draft = draftProductRef.current!

    let resolvedBrandId = draft.brand_id
    if (resolvedBrandId?.startsWith('__new__:')) {
      const brand = await createBrand.mutateAsync({ name: resolvedBrandId.slice(8) })
      resolvedBrandId = brand.id
    }

    const product = await createProduct.mutateAsync({
      name: draft.name,
      brand_id: resolvedBrandId || undefined,
      model_number: draft.modelNumber.trim() || undefined,
      category: draft.category || undefined,
      region_id: draft.regionId || undefined,
    })

    // Persist the id immediately after DB creation so retries are safe.
    createdProductIdRef.current = product.id

    if (draft.pendingFile) {
      const uploaded = await uploadImageFiles('product', [draft.pendingFile], getPresignedUrl.mutateAsync)
      if (uploaded[0]) {
        try {
          await confirmProductImage.mutateAsync({
            product_id: product.id,
            r2_key: uploaded[0].r2Key,
            url: uploaded[0].url,
            thumbnail_r2_key: uploaded[0].thumbnailR2Key ?? uploaded[0].r2Key,
            thumbnail_url: uploaded[0].thumbnailUrl ?? uploaded[0].url,
          })
        } catch (err) {
          // confirmProductImage failed: clean up the orphan R2 object.
          await deleteObjects.mutateAsync({
            r2Keys: [uploaded[0].r2Key, uploaded[0].thumbnailR2Key].filter(Boolean) as string[],
          }).catch(() => {})
          throw err
        }
      }
    }

    return product.id
  }

  return { setDraft, reset, createProductForListing }
}
