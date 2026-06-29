import type { MetadataRoute } from 'next'
import { getDb } from '@/server/db/client'
import { SITE_URL } from '@/lib/seo/site'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // service-role(server-only):公開瀏覽表的 RLS 只放行 authenticated,
  // 用 anon key 會讀到空清單導致 sitemap 缺所有動態網址。service-role 繞過 RLS,
  // 因此下方查詢必須自行帶齊「公開可見」過濾(is_removed / status / is_suspended)。
  const supabase = getDb()

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/search`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/connections`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/wishes`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.5,
    },
  ]

  const [{ data: sellers }, { data: products }, { data: connections }, { data: listings }] =
    await Promise.all([
      supabase.from('sellers').select('id, updated_at').eq('is_suspended', false),
      supabase.from('products').select('id, updated_at').eq('is_removed', false),
      // 公開連線：進行中且賣家未停權（對齊 connection.browse 的條件）
      supabase
        .from('connections')
        .select('id, updated_at, seller:sellers!inner(is_suspended)')
        .eq('status', 'active')
        .eq('seller.is_suspended', false),
      // 公開代購：上架中且賣家未停權
      supabase
        .from('listings')
        .select('id, updated_at, seller:sellers!inner(is_suspended)')
        .eq('status', 'active')
        .eq('seller.is_suspended', false),
    ])

  const sellerRoutes: MetadataRoute.Sitemap = (sellers ?? []).map((s) => ({
    url: `${SITE_URL}/sellers/${s.id}`,
    lastModified: s.updated_at ? new Date(s.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const productRoutes: MetadataRoute.Sitemap = (products ?? []).map((p) => ({
    url: `${SITE_URL}/products/${p.id}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  const connectionRoutes: MetadataRoute.Sitemap = (connections ?? []).map((c) => ({
    url: `${SITE_URL}/connections/${c.id}`,
    lastModified: c.updated_at ? new Date(c.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  const listingRoutes: MetadataRoute.Sitemap = (listings ?? []).map((l) => ({
    url: `${SITE_URL}/listings/${l.id}`,
    lastModified: l.updated_at ? new Date(l.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.5,
  }))

  return [
    ...staticRoutes,
    ...sellerRoutes,
    ...productRoutes,
    ...connectionRoutes,
    ...listingRoutes,
  ]
}
