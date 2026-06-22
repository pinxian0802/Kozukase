import type { Metadata } from 'next'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import ConnectionDetailPageClient from './page-client'
import { SITE_URL, SITE_NAME, SITE_TAGLINE } from '@/lib/seo/site'

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('connections')
    .select('title, description, start_date, end_date, region:regions(name)')
    .eq('id', id)
    .single()

  if (!data) return { title: `${SITE_NAME} - ${SITE_TAGLINE}` }

  const region = data.region as unknown as { name: string } | null
  const heading = data.title?.trim() || `${region?.name ?? ''}代購連線`
  const title = `${heading} - ${SITE_NAME}`

  // 描述：優先用賣家自己寫的連線說明，否則用地區＋日期自動組一句
  const ownDesc = data.description?.trim()
  const period =
    data.start_date && data.end_date
      ? `${data.start_date.replace(/-/g, '/')}～${data.end_date.replace(/-/g, '/')}出發，`
      : ''
  const description = ownDesc
    ? ownDesc.slice(0, 120)
    : `${region?.name ? `${region.name}代購連線，` : ''}${period}在 ${SITE_NAME} 查看這檔連線的代購商品、運費與下單方式。`

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/connections/${id}` },
  }
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ConnectionDetailPageClient params={params} />
}
