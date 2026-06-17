import type { Metadata } from 'next'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import WishDetailPageClient from './page-client'
import { joinParts } from '@/lib/seo/builders'
import { SITE_URL, SITE_NAME } from '@/lib/seo/site'

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('wishes')
    .select('product:products(name, model_number, brand:brands(name)), user:profiles(display_name)')
    .eq('id', id)
    .single()

  if (!data) return { title: `${SITE_NAME} - 代購比價平台` }

  const product = data.product as unknown as
    | { name: string; model_number: string | null; brand: { name: string } | null }
    | null
  const user = data.user as unknown as { display_name: string } | null
  const label = joinParts([product?.brand?.name, product?.name, product?.model_number])
  const title = `${label}${user?.display_name ? ` ${user.display_name}的許願` : ''} - ${SITE_NAME}`

  return {
    title,
    alternates: { canonical: `${SITE_URL}/wishes/${id}` },
  }
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <WishDetailPageClient params={params} />
}
