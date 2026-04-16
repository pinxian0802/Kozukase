import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, adminProcedure } from '../trpc'

export const adminRouter = router({
  // Product management
  removeProduct: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Soft delete product
      await ctx.db
        .from('products')
        .update({
          is_removed: true,
          removed_at: new Date().toISOString(),
          removed_by: ctx.user.id,
        })
        .eq('id', input.id)

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
        const sellerNotifications = listings.map((l: any) => ({
          recipient_id: l.seller_id,
          type: 'product_removed' as const,
          payload: { product_id: input.id, listing_id: l.id },
        }))
        await ctx.db.from('notifications').insert(sellerNotifications)
      }

      // Notify product creator
      const { data: product } = await ctx.db
        .from('products')
        .select('created_by')
        .eq('id', input.id)
        .single()

      if (product) {
        await ctx.db.from('notifications').insert({
          recipient_id: product.created_by,
          type: 'product_removed_creator',
          payload: { product_id: input.id },
        })
      }

      // Cancel all wishes and notify wishers
      const { data: wishes } = await ctx.db
        .from('wishes')
        .select('user_id')
        .eq('product_id', input.id)

      if (wishes?.length) {
        const wishNotifications = wishes.map((w: any) => ({
          recipient_id: w.user_id,
          type: 'wish_product_removed' as const,
          payload: { product_id: input.id },
        }))
        await ctx.db.from('notifications').insert(wishNotifications)
        await ctx.db.from('wishes').delete().eq('product_id', input.id)
      }

      // Notify users who bookmarked
      const { data: bookmarks } = await ctx.db
        .from('product_bookmarks')
        .select('user_id')
        .eq('product_id', input.id)

      if (bookmarks?.length) {
        const bookmarkNotifications = bookmarks.map((b: any) => ({
          recipient_id: b.user_id,
          type: 'bookmarked_product_removed' as const,
          payload: { product_id: input.id },
        }))
        await ctx.db.from('notifications').insert(bookmarkNotifications)
      }

      return { success: true }
    }),

  setProductCategory: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      category: z.enum(['fashion', 'beauty', 'food', 'electronics', 'lifestyle', 'toys', 'limited', 'other']),
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
        .select('seller_id')
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
      await ctx.db.from('notifications').insert({
        recipient_id: listing.seller_id,
        type: 'listing_removed_by_admin',
        payload: { listing_id: input.id, admin_note: input.admin_note },
      })

      return { success: true }
    }),

  approveListing: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: listing } = await ctx.db
        .from('listings')
        .select('seller_id')
        .eq('id', input.id)
        .eq('status', 'pending_approval')
        .single()

      if (!listing) throw new TRPCError({ code: 'NOT_FOUND' })

      await ctx.db
        .from('listings')
        .update({ status: 'active', admin_note: null })
        .eq('id', input.id)

      await ctx.db.from('notifications').insert({
        recipient_id: listing.seller_id,
        type: 'listing_republish_approved',
        payload: { listing_id: input.id },
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
        .select('seller_id')
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
        payload: { connection_id: input.id, admin_note: input.admin_note },
      })

      return { success: true }
    }),

  approveConnection: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: connection } = await ctx.db
        .from('connections')
        .select('seller_id')
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
        payload: { connection_id: input.id },
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
          listing:listings(id, product:products(name)),
          review:reviews(id, comment),
          connection:connections(id, description),
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
      status: z.enum(['resolved', 'dismissed']),
      admin_note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.db
        .from('reports')
        .update({
          status: input.status,
          admin_note: input.admin_note ?? null,
          resolved_at: new Date().toISOString(),
          resolved_by: ctx.user.id,
        })
        .eq('id', input.id)
        .select()
        .single()

      if (error) throw error
      return data
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
          product:products(id, name, catalog_image:product_images!fk_catalog_image(url), product_images:product_images!product_images_product_id_fkey(id, url)),
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
          product_images:product_images!product_images_product_id_fkey(id, url),
          catalog_image:product_images!fk_catalog_image(id, url)
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
})
