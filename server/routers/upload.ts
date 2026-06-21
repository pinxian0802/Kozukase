import { randomUUID } from 'crypto'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { router, protectedProcedure } from '../trpc'
import { s3Client } from '@/lib/r2'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

type ImagePurpose = 'product' | 'listing' | 'connection' | 'avatar' | 'message'

function ownedKeyPrefix(purpose: ImagePurpose, userId: string): string {
  return `images/${purpose}/users/${userId}/`
}

function expectedPublicUrl(r2Key: string): string {
  return `${process.env.R2_PUBLIC_URL}/${r2Key}`
}

function assertOwnedR2Key(r2Key: string, purpose: ImagePurpose, userId: string) {
  const prefix = ownedKeyPrefix(purpose, userId)
  if (!r2Key.startsWith(prefix) || r2Key.includes('..')) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '無效的圖片金鑰' })
  }
}

function assertUrlMatchesKey(url: string, r2Key: string) {
  if (url !== expectedPublicUrl(r2Key)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '圖片 URL 與金鑰不符' })
  }
}

export const uploadRouter = router({
  getPresignedUrl: protectedProcedure
    .input(z.object({
      purpose: z.enum(['product', 'listing', 'connection', 'avatar', 'message', 'banner']),
      contentType: z.string(),
      fileSize: z.number(),
      variant: z.enum(['original', 'thumbnail']).default('original'),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ALLOWED_TYPES.includes(input.contentType)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '不支援的圖片格式，請使用 JPEG、PNG 或 WebP' })
      }

      if (input.fileSize > MAX_FILE_SIZE) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '圖片大小不可超過 5MB' })
      }

      const r2Key = `images/${input.purpose}/users/${ctx.user.id}/${input.variant}/${randomUUID()}.webp`

      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: r2Key,
        ContentType: input.contentType,
        ContentLength: input.fileSize,
        CacheControl: 'public, max-age=31536000, immutable',
      })

      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 })

      return {
        presignedUrl,
        r2Key,
        publicUrl: `${process.env.R2_PUBLIC_URL}/${r2Key}`,
      }
    }),

  confirmProductImage: protectedProcedure
    .input(z.object({
      product_id: z.string().uuid(),
      r2_key: z.string().min(1).max(500),
      url: z.string().url(),
      thumbnail_r2_key: z.string().min(1).max(500),
      thumbnail_url: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertOwnedR2Key(input.r2_key, 'product', ctx.user.id)
      assertOwnedR2Key(input.thumbnail_r2_key, 'product', ctx.user.id)
      assertUrlMatchesKey(input.url, input.r2_key)
      assertUrlMatchesKey(input.thumbnail_url, input.thumbnail_r2_key)

      const { data: product } = await ctx.db
        .from('products')
        .select('created_by')
        .eq('id', input.product_id)
        .single()

      if (!product) throw new TRPCError({ code: 'NOT_FOUND' })
      if (product.created_by !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' })

      const { data, error } = await ctx.db
        .from('product_images')
        .insert({
          product_id: input.product_id,
          r2_key: input.r2_key,
          url: input.url,
          thumbnail_r2_key: input.thumbnail_r2_key,
          thumbnail_url: input.thumbnail_url,
          uploaded_by: ctx.user.id,
        })
        .select()
        .single()

      if (error) throw error

      const { data: existingProduct } = await ctx.db
        .from('products')
        .select('catalog_image_id')
        .eq('id', input.product_id)
        .single()

      if (existingProduct && !existingProduct.catalog_image_id) {
        await ctx.db
          .from('products')
          .update({ catalog_image_id: data.id })
          .eq('id', input.product_id)
      }

      return data
    }),

  confirmProductImages: protectedProcedure
    .input(z.object({
      product_id: z.string().uuid(),
      images: z.array(z.object({
        r2_key: z.string().min(1).max(500),
        url: z.string().url(),
        thumbnail_r2_key: z.string().min(1).max(500),
        thumbnail_url: z.string().url(),
        sort_order: z.number().min(0).max(4),
      })).min(1).max(5),
    }))
    .mutation(async ({ ctx, input }) => {
      for (const img of input.images) {
        assertOwnedR2Key(img.r2_key, 'product', ctx.user.id)
        assertOwnedR2Key(img.thumbnail_r2_key, 'product', ctx.user.id)
        assertUrlMatchesKey(img.url, img.r2_key)
        assertUrlMatchesKey(img.thumbnail_url, img.thumbnail_r2_key)
      }

      const { data: product } = await ctx.db
        .from('products')
        .select('created_by, catalog_image_id')
        .eq('id', input.product_id)
        .single()

      if (!product) throw new TRPCError({ code: 'NOT_FOUND' })
      if (product.created_by !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' })

      const { data: inserted, error } = await ctx.db
        .from('product_images')
        .insert(input.images.map((img) => ({
          product_id: input.product_id,
          r2_key: img.r2_key,
          url: img.url,
          thumbnail_r2_key: img.thumbnail_r2_key,
          thumbnail_url: img.thumbnail_url,
          sort_order: img.sort_order,
          uploaded_by: ctx.user.id,
        })))
        .select('id, sort_order')

      if (error) throw error

      // 封面未設定時(全新商品),把 sort_order = 0 那張設為 catalog_image。
      if (!product.catalog_image_id) {
        const cover = inserted?.find((row) => row.sort_order === 0) ?? inserted?.[0]
        if (cover) {
          await ctx.db
            .from('products')
            .update({ catalog_image_id: cover.id })
            .eq('id', input.product_id)
        }
      }

      return { success: true }
    }),

  // deleteObjects: permanently removes R2 files during compensating rollback.
  // Only keys that belong to the calling user (by path prefix) are accepted.
  deleteObjects: protectedProcedure
    .input(z.object({
      r2Keys: z.array(z.string().min(1)).min(1).max(20),
    }))
    .mutation(async ({ ctx, input }) => {
      const allowedPrefixes = [
        `images/product/users/${ctx.user.id}/`,
        `images/listing/users/${ctx.user.id}/`,
        `images/connection/users/${ctx.user.id}/`,
        `images/avatar/users/${ctx.user.id}/`,
        `images/message/users/${ctx.user.id}/`,
      ]

      for (const key of input.r2Keys) {
        if (key.includes('..') || !allowedPrefixes.some(prefix => key.startsWith(prefix))) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '無法刪除不屬於你的檔案' })
        }
      }

      await Promise.all(
        input.r2Keys.map(key =>
          s3Client.send(new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
          }))
        )
      )

      return { deleted: input.r2Keys.length }
    }),

  confirmListingImages: protectedProcedure
    .input(z.object({
      listing_id: z.string().uuid(),
      images: z.array(z.object({
        r2_key: z.string().min(1).max(500),
        url: z.string().url(),
        thumbnail_r2_key: z.string().min(1).max(500),
        thumbnail_url: z.string().url(),
        sort_order: z.number().min(0).max(4),
      })).max(5),
    }))
    .mutation(async ({ ctx, input }) => {
      for (const img of input.images) {
        assertOwnedR2Key(img.r2_key, 'listing', ctx.user.id)
        assertOwnedR2Key(img.thumbnail_r2_key, 'listing', ctx.user.id)
        assertUrlMatchesKey(img.url, img.r2_key)
        assertUrlMatchesKey(img.thumbnail_url, img.thumbnail_r2_key)
      }

      // Verify listing ownership
      const { data: listing } = await ctx.db
        .from('listings')
        .select('seller_id')
        .eq('id', input.listing_id)
        .single()

      if (!listing) throw new TRPCError({ code: 'NOT_FOUND' })

      const { data: seller } = await ctx.db
        .from('sellers')
        .select('id')
        .eq('id', ctx.user.id)
        .single()

      if (!seller || listing.seller_id !== seller.id) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      // Atomic replace via PostgreSQL function (migration 00005):
      // DELETE + INSERT run as one transaction — insert failure automatically
      // rolls back the delete, so existing images are never lost.
      const { error } = await ctx.db.rpc('replace_listing_images', {
        p_listing_id: input.listing_id,
        p_images: input.images,
      })

      if (error) throw error
      return { success: true }
    }),


  confirmConnectionImages: protectedProcedure
    .input(z.object({
      connection_id: z.string().uuid(),
      images: z.array(z.object({
        r2_key: z.string().min(1).max(500),
        url: z.string().url(),
        thumbnail_r2_key: z.string().min(1).max(500),
        thumbnail_url: z.string().url(),
        sort_order: z.number().min(0).max(4),
      })).max(5),
    }))
    .mutation(async ({ ctx, input }) => {
      for (const img of input.images) {
        assertOwnedR2Key(img.r2_key, 'connection', ctx.user.id)
        assertOwnedR2Key(img.thumbnail_r2_key, 'connection', ctx.user.id)
        assertUrlMatchesKey(img.url, img.r2_key)
        assertUrlMatchesKey(img.thumbnail_url, img.thumbnail_r2_key)
      }

      // Verify connection ownership before modifying images
      const { data: connection } = await ctx.db
        .from('connections')
        .select('seller_id')
        .eq('id', input.connection_id)
        .single()

      if (!connection) throw new TRPCError({ code: 'NOT_FOUND' })

      const { data: seller } = await ctx.db
        .from('sellers')
        .select('id')
        .eq('id', ctx.user.id)
        .single()

      if (!seller || connection.seller_id !== seller.id) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      // Atomic replace via PostgreSQL function (migration 00005)
      const { error } = await ctx.db.rpc('replace_connection_images', {
        p_connection_id: input.connection_id,
        p_images: input.images,
      })

      if (error) throw error
      return { success: true }
    }),
})
