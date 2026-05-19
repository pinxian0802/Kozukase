import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: 'https://kozukase.com',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: 'https://kozukase.com/search',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ]

  const [{ data: sellers }, { data: products }] = await Promise.all([
    supabase.from('sellers').select('id, updated_at').eq('is_suspended', false),
    supabase.from('products').select('id, updated_at'),
  ])

  const sellerRoutes: MetadataRoute.Sitemap = (sellers ?? []).map((s) => ({
    url: `https://kozukase.com/sellers/${s.id}`,
    lastModified: s.updated_at ? new Date(s.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const productRoutes: MetadataRoute.Sitemap = (products ?? []).map((p) => ({
    url: `https://kozukase.com/products/${p.id}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  return [...staticRoutes, ...sellerRoutes, ...productRoutes]
}
