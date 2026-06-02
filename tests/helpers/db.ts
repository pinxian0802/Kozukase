import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { e2eName } from './naming'

let _client: SupabaseClient | null = null

export function dbAdmin(): SupabaseClient {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  _client = createClient(url, key, { auth: { persistSession: false } })
  return _client
}

export async function getUserIdByEmail(email: string): Promise<string> {
  // Page through admin users until we find the email.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await dbAdmin().auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const user = data.users.find((u) => u.email === email)
    if (user) return user.id
    if (data.users.length < 1000) break
  }
  throw new Error(`No auth user for ${email}`)
}

// sellers.id === profiles.id === auth.users.id
export async function getSellerIdByEmail(email: string): Promise<string> {
  return getUserIdByEmail(email)
}

export async function getProductWishCount(productId: string): Promise<number> {
  const { data, error } = await dbAdmin().from('products').select('wish_count').eq('id', productId).single()
  if (error) throw error
  return data.wish_count as number
}

export async function getSellerStats(
  sellerId: string,
): Promise<{ avg_rating: number | null; review_count: number }> {
  const { data, error } = await dbAdmin()
    .from('sellers')
    .select('avg_rating, review_count')
    .eq('id', sellerId)
    .single()
  if (error) throw error
  return { avg_rating: data.avg_rating as number | null, review_count: data.review_count as number }
}

export async function getNotificationCount(recipientId: string, type: string): Promise<number> {
  const { count, error } = await dbAdmin()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', recipientId)
    .eq('type', type)
  if (error) throw error
  return count ?? 0
}

export type SeededListing = {
  productId: string
  listingId: string
  sellerId: string
  productName: string
}

export type SeededListingFull = SeededListing & { title: string }

// Creates an [E2E] product + listing owned by the given seller, bypassing
// app-layer image validation (DB has no image-required trigger on active).
export async function seedListing(
  sellerEmail: string,
  status: 'active' | 'draft' | 'pending_approval' = 'active',
): Promise<SeededListingFull> {
  const sellerId = await getSellerIdByEmail(sellerEmail)
  const productName = e2eName('商品')
  const title = e2eName('代購')

  const { data: prod, error: e1 } = await dbAdmin()
    .from('products')
    .insert({ name: productName, category: 'other', created_by: sellerId })
    .select('id')
    .single()
  if (e1) throw e1

  const { data: lst, error: e2 } = await dbAdmin()
    .from('listings')
    .insert({
      product_id: prod.id,
      seller_id: sellerId,
      title,
      status,
      post_url: 'https://example.com/p/e2e',
      shipping_date: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
      price: 1000,
    })
    .select('id')
    .single()
  if (e2) throw e2

  return { productId: prod.id, listingId: lst.id, sellerId, productName, title }
}

export async function seedActiveListing(sellerEmail: string): Promise<SeededListingFull> {
  return seedListing(sellerEmail, 'active')
}

export async function seedPendingListing(sellerEmail: string): Promise<SeededListingFull> {
  return seedListing(sellerEmail, 'pending_approval')
}

// Attaches one valid image to a seeded listing so the edit form passes its
// "至少需要一張圖片" check, and the republish submit (which re-confirms the
// existing images) passes the R2 ownership assertions: r2_key must start with
// images/listing/users/{userId}/ and url must equal R2_PUBLIC_URL/{r2_key}.
// sellers.id === auth user id, so pass the seed's sellerId here.
export async function addListingImage(listingId: string, sellerUserId: string): Promise<void> {
  const key = `images/listing/users/${sellerUserId}/e2e.jpg`
  const { error } = await dbAdmin()
    .from('listing_images')
    .insert({ listing_id: listingId, r2_key: key, url: `${process.env.R2_PUBLIC_URL}/${key}`, sort_order: 0 })
  if (error) throw error
}

export type SeededConnection = {
  connectionId: string
  sellerId: string
  title: string
  description: string
}

// Creates an [E2E] active connection owned by the given seller, bypassing the
// app-layer 5-per-seller limit and URL validation. `description` is unique so
// the admin "今日新增 → 連線" card can be located by it (that view shows the
// region + seller + description, not the title).
export async function seedActiveConnection(sellerEmail: string): Promise<SeededConnection> {
  const sellerId = await getSellerIdByEmail(sellerEmail)

  const { data: region, error: re } = await dbAdmin()
    .from('regions')
    .select('id')
    .limit(1)
    .single()
  if (re || !region) throw new Error(`seedActiveConnection: no regions row (${re?.message ?? 'empty'})`)

  const title = e2eName('連線')
  const description = e2eName('連線說明')
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const { data, error } = await dbAdmin()
    .from('connections')
    .insert({
      seller_id: sellerId,
      region_id: region.id,
      title,
      description,
      locations: [],
      start_date: fmt(today),
      end_date: fmt(new Date(today.getTime() + 30 * 864e5)),
      shipping_date: fmt(new Date(today.getTime() + 40 * 864e5)),
      billing_method: '[E2E] 現金',
      status: 'active',
    })
    .select('id')
    .single()
  if (error) throw error

  return { connectionId: data.id, sellerId, title, description }
}

export async function seedPendingConnection(sellerEmail: string): Promise<SeededConnection> {
  const sellerId = await getSellerIdByEmail(sellerEmail)

  const { data: region, error: re } = await dbAdmin()
    .from('regions')
    .select('id')
    .limit(1)
    .single()
  if (re || !region) throw new Error(`seedPendingConnection: no regions row (${re?.message ?? 'empty'})`)

  const title = e2eName('連線')
  const description = e2eName('連線說明')
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const { data, error } = await dbAdmin()
    .from('connections')
    .insert({
      seller_id: sellerId,
      region_id: region.id,
      title,
      description,
      locations: [],
      start_date: fmt(today),
      end_date: fmt(new Date(today.getTime() + 30 * 864e5)),
      shipping_date: fmt(new Date(today.getTime() + 40 * 864e5)),
      status: 'pending_approval',
    })
    .select('id')
    .single()
  if (error) throw error

  return { connectionId: data.id, sellerId, title, description }
}

// Upserts a visible review by (seller, reviewer) so it can be reported/hidden.
// reviews has UNIQUE(seller_id, reviewer_id); upsert keeps re-runs idempotent.
export async function seedReview(
  sellerEmail: string,
  reviewerEmail: string,
): Promise<{ reviewId: string; sellerId: string; reviewerId: string }> {
  const sellerId = await getSellerIdByEmail(sellerEmail)
  const reviewerId = await getUserIdByEmail(reviewerEmail)
  const { data, error } = await dbAdmin()
    .from('reviews')
    .upsert(
      { seller_id: sellerId, reviewer_id: reviewerId, rating: 3, comment: e2eName('評價'), status: 'visible' },
      { onConflict: 'seller_id,reviewer_id' },
    )
    .select('id')
    .single()
  if (error) throw error
  return { reviewId: data.id, sellerId, reviewerId }
}

// Most-recent report row for a given target (reports has one FK column set).
export async function getLatestReport(
  target: 'listing_id' | 'connection_id' | 'seller_id' | 'review_id',
  id: string,
): Promise<{ id: string; status: string; admin_note: string | null } | null> {
  const { data, error } = await dbAdmin()
    .from('reports')
    .select('id, status, admin_note')
    .eq(target, id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as { id: string; status: string; admin_note: string | null } | null
}

// Total notifications for a recipient (any type) — used to assert that an
// action produced NO notification at all.
export async function getNotificationCountAll(recipientId: string): Promise<number> {
  const { count, error } = await dbAdmin()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', recipientId)
  if (error) throw error
  return count ?? 0
}
