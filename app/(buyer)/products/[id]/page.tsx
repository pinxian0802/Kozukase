import type { Metadata } from 'next'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import ProductPageClient from './page-client'

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('products')
    .select('name')
    .eq('id', id)
    .single()

  if (!data) {
    return { title: 'Kozukase | 日本代購比價平台' }
  }

  return {
    title: `${data.name} 代購比價 · Kozukase`,
    description: `在 Kozukase 比較多位代購的 ${data.name} 價格、運費與現貨狀態。`,
    alternates: { canonical: `https://kozukase.com/products/${id}` },
    openGraph: {
      title: `${data.name} 代購比價 · Kozukase`,
      description: `在 Kozukase 比較多位代購的 ${data.name} 價格、運費與現貨狀態。`,
    },
  }
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ProductPageClient params={params} />
}
