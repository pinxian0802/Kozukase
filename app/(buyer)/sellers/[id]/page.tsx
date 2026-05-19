import type { Metadata } from 'next'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import SellerPageClient from './page-client'

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('sellers')
    .select('name')
    .eq('id', id)
    .eq('is_suspended', false)
    .single()

  if (!data) {
    return { title: 'Kozukase | 日本代購比價平台' }
  }

  return {
    title: `${data.name} · Kozukase 日本代購`,
    description: `比較 ${data.name} 的日本代購商品、查看評價與服務條件。`,
    alternates: { canonical: `https://kozukase.com/sellers/${id}` },
    openGraph: {
      title: `${data.name} · Kozukase 日本代購`,
      description: `比較 ${data.name} 的日本代購商品、查看評價與服務條件。`,
    },
  }
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <SellerPageClient params={params} />
}
