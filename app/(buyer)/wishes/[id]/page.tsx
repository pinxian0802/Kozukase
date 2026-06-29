import type { Metadata } from 'next'
import { getDb } from '@/server/db/client'
import WishDetailPageClient from './page-client'
import { joinParts } from '@/lib/seo/builders'
import { SITE_URL, SITE_NAME, SITE_TAGLINE } from '@/lib/seo/site'

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params
  // service-role(server-only):未登入也要讀得到 metadata
  const supabase = getDb()
  const { data } = await supabase
    .from('wishes')
    .select('content, product:products(name, model_number, brand:brands(name)), user:profiles(display_name)')
    .eq('id', id)
    .single()

  if (!data) return { title: `${SITE_NAME} - ${SITE_TAGLINE}` }

  const product = data.product as unknown as
    | { name: string; model_number: string | null; brand: { name: string } | null }
    | null
  const user = data.user as unknown as { display_name: string } | null
  const label = joinParts([product?.brand?.name, product?.name, product?.model_number])
  const title = `${label}${user?.display_name ? ` ${user.display_name}的許願` : ''} - ${SITE_NAME}`

  // 描述：優先用買家自己寫的許願內容，否則自動組一句邀請代購接單
  const ownContent = data.content?.trim()
  const description = ownContent
    ? ownContent.slice(0, 120)
    : `${user?.display_name ?? '有買家'}正在 ${SITE_NAME} 許願 ${label}，代購可在此查看並提供報價。`

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/wishes/${id}` },
  }
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <WishDetailPageClient params={params} />
}
