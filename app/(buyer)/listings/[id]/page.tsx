import type { Metadata } from 'next'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import ListingPageClient from './page-client'

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('listings')
    .select('product:products(name), seller:sellers(name)')
    .eq('id', id)
    .single()

  if (!data) {
    return { title: 'Kozukase | 日本代購比價平台' }
  }

  const productName = (data.product as { name: string } | null)?.name ?? ''
  const sellerName = (data.seller as { name: string } | null)?.name ?? ''

  return {
    title: `${productName} · ${sellerName} · Kozukase`,
    description: `${sellerName} 提供的 ${productName} 代購服務，查看價格與詳細資訊。`,
    alternates: { canonical: `https://kozukase.com/listings/${id}` },
    openGraph: {
      title: `${productName} · ${sellerName} · Kozukase`,
      description: `${sellerName} 提供的 ${productName} 代購服務，查看價格與詳細資訊。`,
    },
  }
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ListingPageClient params={params} />
}
