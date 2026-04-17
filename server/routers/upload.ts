import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { router, protectedProcedure } from '../trpc'

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
})

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export const uploadRouter = router({
  getPresignedUrl: protectedProcedure
    .input(z.object({
      purpose: z.enum(['product', 'listing', 'connection', 'avatar']),
      contentType: z.string(),
      fileSize: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ALLOWED_TYPES.includes(input.contentType)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '不支援的圖片格式，請使用 JPEG、PNG 或 WebP' })
      }

      if (input.fileSize > MAX_FILE_SIZE) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '圖片大小不可超過 5MB' })
      }

      const r2Key = `${input.purpose}/${ctx.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`

      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: r2Key,
        ContentType: input.contentType,
        ContentLength: input.fileSize,
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
      r2_key: z.string(),
      url: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.db
        .from('product_images')
        .insert({
          product_id: input.product_id,
          r2_key: input.r2_key,
          url: input.url,
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

  confirmListingImages: protectedProcedure
    .input(z.object({
      listing_id: z.string().uuid(),
      images: z.array(z.object({
        r2_key: z.string(),
        url: z.string().url(),
        sort_order: z.number().min(0).max(4),
      })).max(5),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify listing ownership
      const { data: listing } = await ctx.db
        .from('listings')
        .select('seller_id')
        .eq('id', input.listing_id)
        .single()

      if (!listing) throw new TRPCError({ code: 'NOT_FOUND' })

      // Check seller ownership via seller table
      const { data: seller } = await ctx.db
        .from('sellers')
        .select('id')
        .eq('id', ctx.user.id)
        .single()

      if (!seller || listing.seller_id !== seller.id) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      await ctx.db
        .from('listing_images')
        .delete()
        .eq('listing_id', input.listing_id)

      if (input.images.length === 0) {
        return []
      }

      const rows = input.images.map(img => ({
        listing_id: input.listing_id,
        r2_key: img.r2_key,
        url: img.url,
        sort_order: img.sort_order,
      }))

      const { data, error } = await ctx.db
        .from('listing_images')
        .insert(rows)
        .select()

      if (error) throw error
      return data
    }),

  confirmConnectionImages: protectedProcedure
    .input(z.object({
      connection_id: z.string().uuid(),
      images: z.array(z.object({
        r2_key: z.string(),
        url: z.string().url(),
        sort_order: z.number().min(0).max(4),
      })).max(5),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .from('connection_images')
        .delete()
        .eq('connection_id', input.connection_id)

      if (input.images.length === 0) {
        return []
      }

      const rows = input.images.map(img => ({
        connection_id: input.connection_id,
        r2_key: img.r2_key,
        url: img.url,
        sort_order: img.sort_order,
      }))

      const { data, error } = await ctx.db
        .from('connection_images')
        .insert(rows)
        .select()

      if (error) throw error
      return data
    }),
})
