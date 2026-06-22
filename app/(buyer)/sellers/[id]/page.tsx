import type { Metadata } from 'next'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import SellerPageClient from './page-client'
import { JsonLd } from '@/lib/seo/jsonld'
import { buildSellerJsonLd, buildBreadcrumbJsonLd } from '@/lib/seo/builders'
import { SITE_URL, SITE_NAME, SITE_TAGLINE } from '@/lib/seo/site'

type SellerSeo = {
  name: string
  avatar_url: string | null
  ig_handle: string | null
  threads_handle: string | null
  avg_rating: number | null
  review_count: number
}

async function getSellerSeo(id: string) {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('sellers')
    .select('name, avatar_url, ig_handle, threads_handle, avg_rating, review_count')
    .eq('id', id)
    .eq('is_suspended', false)
    .single()
  return (data as SellerSeo | null) ?? null
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params
  const s = await getSellerSeo(id)
  if (!s) return { title: `${SITE_NAME} - ${SITE_TAGLINE}` }

  const title = `${s.name}在 ${SITE_NAME} 的賣場`
  const description = `比較 ${s.name} 的代購商品、查看評價與服務條件。`
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/sellers/${id}` },
    openGraph: {
      title,
      description,
      images: s.avatar_url ? [{ url: s.avatar_url }] : undefined,
    },
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const s = await getSellerSeo(id)

  return (
    <>
      {s && (
        <JsonLd
          data={[
            buildSellerJsonLd({
              id,
              name: s.name,
              avatarUrl: s.avatar_url,
              igHandle: s.ig_handle,
              threadsHandle: s.threads_handle,
              avgRating: s.avg_rating,
              reviewCount: s.review_count,
            }),
            buildBreadcrumbJsonLd([
              { name: '首頁', url: SITE_URL },
              { name: s.name, url: `${SITE_URL}/sellers/${id}` },
            ]),
          ]}
        />
      )}
      <SellerPageClient params={params} />
    </>
  )
}
