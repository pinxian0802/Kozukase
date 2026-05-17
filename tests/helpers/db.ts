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
  status: 'active' | 'draft' = 'active',
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
