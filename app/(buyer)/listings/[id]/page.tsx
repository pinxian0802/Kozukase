import type { Metadata } from 'next'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import ListingPageClient from './page-client'
import { joinParts } from '@/lib/seo/builders'
import { SITE_URL, SITE_NAME, SITE_TAGLINE } from '@/lib/seo/site'

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('listings')
    .select('product:products(name, model_number, brand:brands(name)), seller:sellers(name)')
    .eq('id', id)
    .single()

  if (!data) return { title: `${SITE_NAME} - ${SITE_TAGLINE}` }

  const product = data.product as unknown as
    | { name: string; model_number: string | null; brand: { name: string } | null }
    | null
  const seller = data.seller as unknown as { name: string } | null
  const productLabel = joinParts([product?.brand?.name, product?.name, product?.model_number])
  const sellerName = seller?.name ?? ''
  const title = `${productLabel} · ${sellerName} - ${SITE_NAME}`
  const description = `${sellerName} 提供的 ${product?.name ?? ''} 代購服務，查看價格與詳細資訊。`

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/listings/${id}` },
    openGraph: { title, description },
  }
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ListingPageClient params={params} />
}
