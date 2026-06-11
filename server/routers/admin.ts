import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, adminProcedure } from '../trpc'
import { productCategoryEnum } from '@/lib/validators/product'

function buildAdminDisplayName(user: {
  email?: string | null
  user_metadata?: { full_name?: string | null } | null
}, profile?: { display_name?: string | null } | null) {
  return profile?.display_name ?? user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User'
}

// Returns today's midnight in UTC+8 (Asia/Taipei, no DST) as a UTC ISO string.
function getTodayStartUTC8(): string {
  const now = new Date()
  const utc8Now = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  utc8Now.setUTCHours(0, 0, 0, 0)
  return new Date(utc8Now.getTime() - 8 * 60 * 60 * 1000).toISOString()
}

export const adminRouter = router({
  // Product management
  removeProduct: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Soft delete product (return name for notifications)
      const { data: product } = await ctx.db
        .from('products')
        .update({
          is_removed: true,
          removed_at: new Date().toISOString(),
          removed_by: ctx.user.id,
        })
        .eq('id', input.id)
        .select('name')
        .maybeSingle()

      const productName = product?.name ?? null

      // Get affected listings
      const { data: listings } = await ctx.db
        .from('listings')
        .select('id, seller_id')
        .eq('product_id', input.id)
        .in('status', ['active', 'pending_approval'])

      // Deactivate all listings
      await ctx.db
        .from('listings')
        .update({ status: 'inactive', inactive_reason: 'product_removed' })
        .eq('product_id', input.id)
        .in('status', ['active', 'pending_approval'])

      // Notify affected sellers
      if (listings?.length) {
        const sellerNotifications = listings.map((listing: { id: string; seller_id: string }) => ({
          recipient_id: listing.seller_id,
          type: 'product_removed' as const,
          payload: { product_id: input.id, listing_id: listing.id, product_name: productName },
        }))
        await ctx.db.from('notifications').insert(sellerNotifications)
      }

      // Cancel all wishes for this product
      await ctx.db.from('wishes').delete().eq('product_id', input.id)

      return { success: true }
    }),

  setProductCategory: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      category: productCategoryEnum,
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.db
        .from('products')
        .update({ category: input.category })
        .eq('id', input.id)
        .select()
        .single()

      if (error) throw error
      return data
    }),

  setCatalogImage: adminProcedure
    .input(z.object({
      product_id: z.string().uuid(),
      image_id: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.db
        .from('products')
        .update({ catalog_image_id: input.image_id })
        .eq('id', input.product_id)
        .select()
        .single()

      if (error) throw error
      return data
    }),

  // Listing management
  removeListing: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      admin_note: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: listing } = await ctx.db
        .from('listings')
        .select('seller_id, product:products(name)')
        .eq('id', input.id)
        .single()

      if (!listing) throw new TRPCError({ code: 'NOT_FOUND' })

      await ctx.db
        .from('listings')
        .update({
          status: 'inactive',
          inactive_reason: 'admin',
          admin_note: input.admin_note,
        })
        .eq('id', input.id)

      // Notify seller
      const listingProduct = Array.isArray(listing.product) ? listing.product[0] : listing.product
      await ctx.db.from('notifications').insert({
        recipient_id: listing.seller_id,
        type: 'listing_removed_by_admin',
        payload: {
          listing_id: input.id,
          admin_note: input.admin_note,
          product_name: listingProduct?.name ?? null,
        },
      })

      return { success: true }
    }),

  approveListing: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: listing } = await ctx.db
        .from('listings')
        .select('seller_id, product:products(name)')
        .eq('id', input.id)
        .eq('status', 'pending_approval')
        .single()

      if (!listing) throw new TRPCError({ code: 'NOT_FOUND' })

      await ctx.db
        .from('listings')
        .update({ status: 'active', admin_note: null })
        .eq('id', input.id)

      const listingProduct = Array.isArray(listing.product) ? listing.product[0] : listing.product
      await ctx.db.from('notifications').insert({
        recipient_id: listing.seller_id,
        type: 'listing_republish_approved',
        payload: { listing_id: input.id, product_name: listingProduct?.name ?? null },
      })

      return { success: true }
    }),

  // Connection management
  removeConnection: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      admin_note: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: connection } = await ctx.db
        .from('connections')
        .select('seller_id, title')
        .eq('id', input.id)
        .single()

      if (!connection) throw new TRPCError({ code: 'NOT_FOUND' })

      await ctx.db
        .from('connections')
        .update({
          status: 'ended',
          ended_reason: 'admin',
          admin_note: input.admin_note,
        })
        .eq('id', input.id)

      await ctx.db.from('notifications').insert({
        recipient_id: connection.seller_id,
        type: 'connection_removed_by_admin',
        payload: {
          connection_id: input.id,
          admin_note: input.admin_note,
          connection_title: connection.title ?? null,
        },
      })

      return { success: true }
    }),

  approveConnection: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: connection } = await ctx.db
        .from('connections')
        .select('seller_id, title')
        .eq('id', input.id)
        .eq('status', 'pending_approval')
        .single()

      if (!connection) throw new TRPCError({ code: 'NOT_FOUND' })

      await ctx.db
        .from('connections')
        .update({ status: 'active', admin_note: null })
        .eq('id', input.id)

      await ctx.db.from('notifications').insert({
        recipient_id: connection.seller_id,
        type: 'connection_republish_approved',
        payload: { connection_id: input.id, connection_title: connection.title ?? null },
      })

      return { success: true }
    }),

  // Report management
  listReports: adminProcedure
    .input(z.object({
      status: z.enum(['pending', 'resolved', 'dismissed']).default('pending'),
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const { data, error, count } = await ctx.db
        .from('reports')
        .select(`
          *,
          reporter:profiles!reporter_id(display_name),
          listing:listings(id, product:products(name), seller:sellers(name)),
          review:reviews(id, comment),
          connection:connections(id, title, seller:sellers(name)),
          reported_seller:sellers!seller_id(id, name)
        `, { count: 'exact' })
        .eq('status', input.status)
        .order('created_at', { ascending: false })
        .range(input.offset, input.offset + input.limit - 1)

      if (error) throw error
      return { items: data ?? [], total: count ?? 0 }
    }),

  resolveReport: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      // takedown = act on the reported target AND close the report;
      // dismiss  = no action, just close the report (clears the queue).
      action: z.enum(['takedown', 'dismiss']),
      admin_note: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: report } = await ctx.db
        .from('reports')
        .select('id, listing_id, connection_id, review_id, seller_id')
        .eq('id', input.id)
        .single()

      if (!report) throw new TRPCError({ code: 'NOT_FOUND' })

      const note = input.admin_note?.trim() || null

      if (input.action === 'dismiss') {
        await ctx.db
          .from('reports')
          .update({
            status: 'dismissed',
            admin_note: note,
            resolved_at: new Date().toISOString(),
            resolved_by: ctx.user.id,
          })
          .eq('id', input.id)
        return { success: true }
      }

      // takedown: the note becomes the reason shown to the affected party.
      if (!note) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '請填寫處理原因（將作為下架理由通知對方）' })
      }

      let targetCol: 'listing_id' | 'connection_id' | 'review_id' | 'seller_id'
      let targetId: string

      if (report.listing_id) {
        targetCol = 'listing_id'
        targetId = report.listing_id
        const { data: listing } = await ctx.db
          .from('listings')
          .select('seller_id, product:products(name)')
          .eq('id', targetId)
          .single()
        if (!listing) throw new TRPCError({ code: 'NOT_FOUND', message: '代購不存在' })
        await ctx.db
          .from('listings')
          .update({ status: 'inactive', inactive_reason: 'admin', admin_note: note })
          .eq('id', targetId)
        const product = Array.isArray(listing.product) ? listing.product[0] : listing.product
        await ctx.db.from('notifications').insert({
          recipient_id: listing.seller_id,
          type: 'listing_removed_by_admin',
          payload: { listing_id: targetId, admin_note: note, product_name: product?.name ?? null },
        })
      } else if (report.connection_id) {
        targetCol = 'connection_id'
        targetId = report.connection_id
        const { data: connection } = await ctx.db
          .from('connections')
          .select('seller_id, title')
          .eq('id', targetId)
          .single()
        if (!connection) throw new TRPCError({ code: 'NOT_FOUND', message: '連線不存在' })
        await ctx.db
          .from('connections')
          .update({ status: 'ended', ended_reason: 'admin', admin_note: note })
          .eq('id', targetId)
        await ctx.db.from('notifications').insert({
          recipient_id: connection.seller_id,
          type: 'connection_removed_by_admin',
          payload: { connection_id: targetId, admin_note: note, connection_title: connection.title ?? null },
        })
      } else if (report.review_id) {
        targetCol = 'review_id'
        targetId = report.review_id
        // Hide the review (no dedicated notification type for hidden reviews).
        await ctx.db.from('reviews').update({ status: 'hidden' }).eq('id', targetId)
      } else if (report.seller_id) {
        targetCol = 'seller_id'
        targetId = report.seller_id
        await ctx.db
          .from('sellers')
          .update({ is_suspended: true, suspended_at: new Date().toISOString() })
          .eq('id', targetId)
        await ctx.db
          .from('listings')
          .update({ status: 'inactive', inactive_reason: 'admin' })
          .eq('seller_id', targetId)
          .in('status', ['active', 'pending_approval'])
        await ctx.db
          .from('connections')
          .update({ status: 'ended', ended_reason: 'admin' })
          .eq('seller_id', targetId)
          .in('status', ['active', 'pending_approval'])
        await ctx.db.from('notifications').insert({
          recipient_id: targetId,
          type: 'account_action_taken',
          payload: { reason: note },
        })
      } else {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '檢舉對象不存在' })
      }

      // Close every pending report pointing at the same target (incl. this one).
      await ctx.db
        .from('reports')
        .update({
          status: 'resolved',
          admin_note: note,
          resolved_at: new Date().toISOString(),
          resolved_by: ctx.user.id,
        })
        .eq(targetCol, targetId)
        .eq('status', 'pending')

      return { success: true }
    }),

  // Seller suspension
  suspendSeller: adminProcedure
    .input(z.object({
      seller_id: z.string().uuid(),
      reason: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .from('sellers')
        .update({
          is_suspended: true,
          suspended_at: new Date().toISOString(),
        })
        .eq('id', input.seller_id)

      // Deactivate all active/pending listings
      await ctx.db
        .from('listings')
        .update({ status: 'inactive', inactive_reason: 'admin' })
        .eq('seller_id', input.seller_id)
        .in('status', ['active', 'pending_approval'])

      // End all active/pending connections
      await ctx.db
        .from('connections')
        .update({ status: 'ended', ended_reason: 'admin' })
        .eq('seller_id', input.seller_id)
        .in('status', ['active', 'pending_approval'])

      // Notify seller
      await ctx.db.from('notifications').insert({
        recipient_id: input.seller_id,
        type: 'account_action_taken',
        payload: { reason: input.reason },
      })

      return { success: true }
    }),

  unsuspendSeller: adminProcedure
    .input(z.object({ seller_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .from('sellers')
        .update({
          is_suspended: false,
          suspended_at: null,
        })
        .eq('id', input.seller_id)

      return { success: true }
    }),

  // Admin listing/connection lists
  pendingListings: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const { data, error, count } = await ctx.db
        .from('listings')
        .select(`
          *,
          product:products(id, name, brand:brands(name), model_number, catalog_image:product_images!fk_catalog_image(id, url, r2_key, thumbnail_url, thumbnail_r2_key), product_images:product_images!product_images_product_id_fkey(id, url, r2_key, thumbnail_url, thumbnail_r2_key)),
          seller:sellers(id, name)
        `, { count: 'exact' })
        .eq('status', 'pending_approval')
        .order('updated_at', { ascending: true })
        .range(input.offset, input.offset + input.limit - 1)

      if (error) throw error
      return { items: data ?? [], total: count ?? 0 }
    }),

  pendingConnections: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const { data, error, count } = await ctx.db
        .from('connections')
        .select(`
          *,
          region:regions(name),
          seller:sellers(id, name)
        `, { count: 'exact' })
        .eq('status', 'pending_approval')
        .order('updated_at', { ascending: true })
        .range(input.offset, input.offset + input.limit - 1)

      if (error) throw error
      return { items: data ?? [], total: count ?? 0 }
    }),

  // Product listing for admin
  listProducts: adminProcedure
    .input(z.object({
      search: z.string().optional(),
      includeRemoved: z.boolean().default(false),
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('products')
        .select(`
          *,
          brand:brands(name),
          product_images:product_images!product_images_product_id_fkey(id, url, r2_key, thumbnail_url, thumbnail_r2_key),
          catalog_image:product_images!fk_catalog_image(id, url, r2_key, thumbnail_url, thumbnail_r2_key)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })

      if (!input.includeRemoved) {
        query = query.eq('is_removed', false)
      }

      if (input.search) {
        query = query.ilike('name', `%${input.search}%`)
      }

      query = query.range(input.offset, input.offset + input.limit - 1)

      const { data, error, count } = await query
      if (error) throw error
      return { items: data ?? [], total: count ?? 0 }
    }),

  updateProduct: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(200),
      brand_id: z.string().uuid().nullable().optional(),
      model_number: z.string().max(100).nullable().optional(),
      category: productCategoryEnum,
      catalog_image_id: z.string().uuid().nullable().optional(),
      aliases: z.array(z.string().max(200)).max(20).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.catalog_image_id) {
        const { data: catalogImage } = await ctx.db
          .from('product_images')
          .select('id, product_id')
          .eq('id', input.catalog_image_id)
          .eq('product_id', input.id)
          .single()

        if (!catalogImage) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '封面圖片必須屬於此商品' })
        }
      }

      const { data, error } = await ctx.db
        .from('products')
        .update({
          name: input.name,
          brand_id: input.brand_id ?? null,
          model_number: input.model_number?.trim() ? input.model_number.trim() : null,
          category: input.category,
          catalog_image_id: input.catalog_image_id ?? null,
          aliases: input.aliases ?? [],
        })
        .eq('id', input.id)
        .select(`
          *,
          product_images:product_images!product_images_product_id_fkey(id, url, r2_key, thumbnail_url, thumbnail_r2_key),
          catalog_image:product_images!fk_catalog_image(id, url, r2_key, thumbnail_url, thumbnail_r2_key)
        `)
        .single()

      if (error) throw error
      return data
    }),

  // Seller list for admin
  listSellers: adminProcedure
    .input(z.object({
      search: z.string().optional(),
      includeSuspended: z.boolean().default(false),
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('sellers')
        .select(`
          *,
          profile:profiles(display_name, avatar_url)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })

      if (!input.includeSuspended) {
        query = query.eq('is_suspended', false)
      }

      if (input.search) {
        query = query.ilike('name', `%${input.search}%`)
      }

      query = query.range(input.offset, input.offset + input.limit - 1)

      const { data, error, count } = await query
      if (error) throw error
      return { items: data ?? [], total: count ?? 0 }
    }),

  listUsers: adminProcedure
    .input(z.object({
      search: z.string().optional(),
      limit: z.number().min(1).max(1000).default(1000),
    }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.db.auth.admin.listUsers({
        page: 1,
        perPage: input.limit,
      })

      if (error) throw error

      const users = data.users ?? []
      const userIds = users.map((user) => user.id)

      if (userIds.length === 0) {
        return { items: [], total: 0 }
      }

      const [profilesResult, sellersResult] = await Promise.all([
        ctx.db
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds),
        ctx.db
          .from('sellers')
          .select('id')
          .in('id', userIds),
      ])

      if (profilesResult.error) throw profilesResult.error
      if (sellersResult.error) throw sellersResult.error

      const profileById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]))
      const sellerIds = new Set((sellersResult.data ?? []).map((seller) => seller.id))

      const items = users
        .map((user) => {
          const profile = profileById.get(user.id)
          const isAdmin = user.app_metadata?.role === 'admin'
          return {
            id: user.id,
            email: user.email ?? null,
            display_name: buildAdminDisplayName(user, profile),
            avatar_url: profile?.avatar_url ?? null,
            is_seller: sellerIds.has(user.id),
            is_admin: isAdmin,
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at ?? null,
          }
        })
        .filter((user) => {
          if (!input.search) return true
          const keyword = input.search.toLowerCase()
          return (
            (user.email ?? '').toLowerCase().includes(keyword) ||
            user.display_name.toLowerCase().includes(keyword) ||
            (user.is_admin ? 'admin' : '').includes(keyword) ||
            (user.is_seller ? 'seller' : '').includes(keyword)
          )
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at))

      return { items, total: items.length }
    }),

  setUserAdmin: adminProcedure
    .input(z.object({
      user_id: z.string().uuid(),
      is_admin: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.db.auth.admin.getUserById(input.user_id)
      if (error) throw error

      if (!data.user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '使用者不存在' })
      }

      const nextAppMetadata = { ...(data.user.app_metadata ?? {}) } as Record<string, unknown>
      if (input.is_admin) {
        nextAppMetadata.role = 'admin'
      } else {
        nextAppMetadata.role = 'user'
      }

      const { data: updatedUser, error: updateError } = await ctx.db.auth.admin.updateUserById(input.user_id, {
        app_metadata: nextAppMetadata,
      })

      if (updateError) throw updateError
      return updatedUser.user
    }),

  todayProducts: adminProcedure
    .query(async ({ ctx }) => {
      const todayStart = getTodayStartUTC8()
      const { data, error } = await ctx.db
        .from('products')
        .select(`
          *,
          brand:brands(name),
          product_images:product_images!product_images_product_id_fkey(id, url, r2_key, thumbnail_url, thumbnail_r2_key),
          catalog_image:product_images!fk_catalog_image(id, url, r2_key, thumbnail_url, thumbnail_r2_key)
        `)
        .gte('created_at', todayStart)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    }),

  todayBrands: adminProcedure
    .query(async ({ ctx }) => {
      const todayStart = getTodayStartUTC8()
      const { data, error } = await ctx.db
        .from('brands')
        .select('id, name, created_at, products:products(count)')
        .gte('created_at', todayStart)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map(b => ({
        ...b,
        // Supabase count aggregate returns [{count}]; type-gen emits never[] so we cast.
        productCount: (b.products as unknown as { count: number }[])[0]?.count ?? 0,
      }))
    }),

  todayListings: adminProcedure
    .query(async ({ ctx }) => {
      const todayStart = getTodayStartUTC8()
      const { data, error } = await ctx.db
        .from('listings')
        .select(`
          *,
          product:products(id, name, brand:brands(name), model_number, catalog_image:product_images!fk_catalog_image(id, url, r2_key, thumbnail_url, thumbnail_r2_key), product_images:product_images!product_images_product_id_fkey(id, url, r2_key, thumbnail_url, thumbnail_r2_key)),
          seller:sellers(id, name)
        `)
        .gte('created_at', todayStart)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    }),

  todayConnections: adminProcedure
    .query(async ({ ctx }) => {
      const todayStart = getTodayStartUTC8()
      const { data, error } = await ctx.db
        .from('connections')
        .select(`
          *,
          region:regions(name),
          seller:sellers(id, name)
        `)
        .gte('created_at', todayStart)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    }),

  renameBrand: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).refine(s => s.trim().length > 0, { message: '品牌名稱不能為空白' }),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.db
        .from('brands')
        .update({ name: input.name.trim() })
        .eq('id', input.id)
        .select('id, name')
        .single()
      if (error) throw error
      return data
    }),

  deleteBrand: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error: updateError } = await ctx.db
        .from('products')
        .update({ brand_id: null })
        .eq('brand_id', input.id)
      if (updateError) throw updateError
      const { error } = await ctx.db
        .from('brands')
        .delete()
        .eq('id', input.id)
      if (error) throw error
      return { success: true }
    }),

  mergeBrand: adminProcedure
    .input(z.object({
      sourceId: z.string().uuid(),
      targetId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.sourceId === input.targetId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '來源與目標品牌不能相同' })
      }
      const { data: targetBrand } = await ctx.db
        .from('brands')
        .select('id')
        .eq('id', input.targetId)
        .single()
      if (!targetBrand) throw new TRPCError({ code: 'NOT_FOUND', message: '目標品牌不存在' })
      const { error: updateError } = await ctx.db
        .from('products')
        .update({ brand_id: input.targetId })
        .eq('brand_id', input.sourceId)
      if (updateError) throw updateError
      const { error } = await ctx.db
        .from('brands')
        .delete()
        .eq('id', input.sourceId)
      if (error) throw error
      return { success: true }
    }),

  mergeProduct: adminProcedure
    .input(z.object({
      sourceId: z.string().uuid(),
      targetId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.sourceId === input.targetId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '來源與目標商品不能相同' })
      }

      const { data: target } = await ctx.db
        .from('products')
        .select('id')
        .eq('id', input.targetId)
        .single()
      if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: '目標商品不存在' })

      // Transfer listings
      const { error: listingsError } = await ctx.db
        .from('listings')
        .update({ product_id: input.targetId })
        .eq('product_id', input.sourceId)
      if (listingsError) throw listingsError

      // Transfer wishes — delete duplicates first (user already wishes for target)
      const { data: conflictWishes } = await ctx.db
        .from('wishes')
        .select('user_id')
        .eq('product_id', input.targetId)
      if (conflictWishes?.length) {
        await ctx.db
          .from('wishes')
          .delete()
          .eq('product_id', input.sourceId)
          .in('user_id', conflictWishes.map((w: { user_id: string }) => w.user_id))
      }
      await ctx.db.from('wishes').update({ product_id: input.targetId }).eq('product_id', input.sourceId)

      // Transfer bookmarks — delete duplicates first
      const { data: conflictBookmarks } = await ctx.db
        .from('product_bookmarks')
        .select('user_id')
        .eq('product_id', input.targetId)
      if (conflictBookmarks?.length) {
        await ctx.db
          .from('product_bookmarks')
          .delete()
          .eq('product_id', input.sourceId)
          .in('user_id', conflictBookmarks.map((b: { user_id: string }) => b.user_id))
      }
      await ctx.db.from('product_bookmarks').update({ product_id: input.targetId }).eq('product_id', input.sourceId)

      // Mark source product as removed
      await ctx.db
        .from('products')
        .update({ is_removed: true, removed_at: new Date().toISOString(), removed_by: ctx.user.id })
        .eq('id', input.sourceId)

      return { success: true }
    }),

  // ── Threads 人工驗證審核 ──
  listThreadsVerifications: adminProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.db
      .from('threads_verification_requests')
      .select('id, seller_id, threads_username, code, created_at, sellers(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) throw error

    return (data ?? []).map((r: {
      id: string
      seller_id: string
      threads_username: string
      code: string
      created_at: string
      sellers: { name: string } | { name: string }[] | null
    }) => ({
      id: r.id,
      seller_id: r.seller_id,
      threads_username: r.threads_username,
      code: r.code,
      created_at: r.created_at,
      seller_name: Array.isArray(r.sellers) ? r.sellers[0]?.name ?? '' : r.sellers?.name ?? '',
    }))
  }),

  // 審核紀錄：已通過 / 已退回，可依審核時間（UTC+8 當日）範圍篩選
  listThreadsVerificationHistory: adminProcedure
    .input(z.object({
      from: z.string().optional(), // yyyy-MM-dd
      to: z.string().optional(),   // yyyy-MM-dd
    }))
    .query(async ({ ctx, input }) => {
      let q = ctx.db
        .from('threads_verification_requests')
        .select('id, seller_id, threads_username, status, reject_reason, reviewed_at, created_at, sellers(name)')
        .in('status', ['approved', 'rejected'])

      if (input.from) {
        q = q.gte('reviewed_at', new Date(`${input.from}T00:00:00+08:00`).toISOString())
      }
      if (input.to) {
        q = q.lte('reviewed_at', new Date(`${input.to}T23:59:59.999+08:00`).toISOString())
      }

      const { data, error } = await q.order('reviewed_at', { ascending: false }).limit(200)

      if (error) throw error

      return (data ?? []).map((r: {
        id: string
        seller_id: string
        threads_username: string
        status: string
        reject_reason: string | null
        reviewed_at: string | null
        created_at: string
        sellers: { name: string } | { name: string }[] | null
      }) => ({
        id: r.id,
        seller_id: r.seller_id,
        threads_username: r.threads_username,
        status: r.status,
        reject_reason: r.reject_reason,
        reviewed_at: r.reviewed_at,
        created_at: r.created_at,
        seller_name: Array.isArray(r.sellers) ? r.sellers[0]?.name ?? '' : r.sellers?.name ?? '',
      }))
    }),

  approveThreadsVerification: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: req } = await ctx.db
        .from('threads_verification_requests')
        .select('id, seller_id, threads_username, status')
        .eq('id', input.id)
        .maybeSingle()

      if (!req) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到此申請' })
      if (req.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '此申請已處理過' })
      }

      await ctx.db
        .from('sellers')
        .update({
          threads_handle: req.threads_username,
          threads_connected_at: new Date().toISOString(),
          is_social_verified: true,
        })
        .eq('id', req.seller_id)

      await ctx.db
        .from('threads_verification_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: ctx.user.id,
        })
        .eq('id', req.id)

      await ctx.db.from('notifications').insert({
        recipient_id: req.seller_id,
        type: 'threads_verification_approved',
        payload: { threads_username: req.threads_username },
      })

      return { success: true }
    }),

  rejectThreadsVerification: adminProcedure
    .input(z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const { data: req } = await ctx.db
        .from('threads_verification_requests')
        .select('id, seller_id, threads_username, status')
        .eq('id', input.id)
        .maybeSingle()

      if (!req) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到此申請' })
      if (req.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '此申請已處理過' })
      }

      await ctx.db
        .from('threads_verification_requests')
        .update({
          status: 'rejected',
          reject_reason: input.reason ?? null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: ctx.user.id,
        })
        .eq('id', req.id)

      await ctx.db.from('notifications').insert({
        recipient_id: req.seller_id,
        type: 'threads_verification_rejected',
        payload: { threads_username: req.threads_username, reason: input.reason ?? null },
      })

      return { success: true }
    }),

  listIgVerifications: adminProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.db
      .from('ig_verification_codes')
      .select('id, seller_id, ig_username, code, created_at, sellers(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map((r: {
      id: string; seller_id: string; ig_username: string; code: string; created_at: string
      sellers: { name: string } | { name: string }[] | null
    }) => ({
      id: r.id,
      seller_id: r.seller_id,
      ig_username: r.ig_username,
      code: r.code,
      created_at: r.created_at,
      seller_name: Array.isArray(r.sellers) ? r.sellers[0]?.name ?? '' : r.sellers?.name ?? '',
    }))
  }),

  listIgVerificationHistory: adminProcedure
    .input(z.object({ from: z.string().optional(), to: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      let q = ctx.db
        .from('ig_verification_codes')
        .select('id, seller_id, ig_username, status, source, reject_reason, reviewed_at, verified_at, created_at, sellers(name)')
        .in('status', ['approved', 'rejected'])
      if (input.from) q = q.gte('reviewed_at', new Date(`${input.from}T00:00:00+08:00`).toISOString())
      if (input.to) q = q.lte('reviewed_at', new Date(`${input.to}T23:59:59.999+08:00`).toISOString())
      const { data, error } = await q.order('created_at', { ascending: false }).limit(200)
      if (error) throw error
      return (data ?? []).map((r: {
        id: string; seller_id: string; ig_username: string; status: string; source: string | null
        reject_reason: string | null; reviewed_at: string | null; verified_at: string | null; created_at: string
        sellers: { name: string } | { name: string }[] | null
      }) => ({
        id: r.id,
        seller_id: r.seller_id,
        ig_username: r.ig_username,
        status: r.status,
        source: r.source,
        reject_reason: r.reject_reason,
        // 自動通過無 reviewed_at，用 verified_at 當審核時間顯示
        reviewed_at: r.reviewed_at ?? r.verified_at,
        created_at: r.created_at,
        seller_name: Array.isArray(r.sellers) ? r.sellers[0]?.name ?? '' : r.sellers?.name ?? '',
      }))
    }),

  approveIgVerification: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: req } = await ctx.db
        .from('ig_verification_codes')
        .select('id, seller_id, ig_username, status')
        .eq('id', input.id)
        .maybeSingle()
      if (!req) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到此申請' })
      if (req.status !== 'pending') throw new TRPCError({ code: 'BAD_REQUEST', message: '此申請已處理過' })

      await ctx.db.from('sellers').update({
        ig_handle: req.ig_username,
        ig_connected_at: new Date().toISOString(),
        is_social_verified: true,
      }).eq('id', req.seller_id)

      await ctx.db.from('ig_verification_codes').update({
        status: 'approved',
        source: 'manual',
        reviewed_at: new Date().toISOString(),
        reviewed_by: ctx.user.id,
      }).eq('id', req.id)

      await ctx.db.from('notifications').insert({
        recipient_id: req.seller_id,
        type: 'ig_verification_approved',
        payload: { ig_username: req.ig_username },
      })
      return { success: true }
    }),

  rejectIgVerification: adminProcedure
    .input(z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const { data: req } = await ctx.db
        .from('ig_verification_codes')
        .select('id, seller_id, ig_username, status')
        .eq('id', input.id)
        .maybeSingle()
      if (!req) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到此申請' })
      if (req.status !== 'pending') throw new TRPCError({ code: 'BAD_REQUEST', message: '此申請已處理過' })

      await ctx.db.from('ig_verification_codes').update({
        status: 'rejected',
        source: 'manual',
        reject_reason: input.reason ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: ctx.user.id,
      }).eq('id', req.id)

      await ctx.db.from('notifications').insert({
        recipient_id: req.seller_id,
        type: 'ig_verification_rejected',
        payload: { ig_username: req.ig_username, reason: input.reason ?? null },
      })
      return { success: true }
    }),
})
