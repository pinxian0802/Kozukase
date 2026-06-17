import type { Metadata } from 'next'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import ConnectionDetailPageClient from './page-client'
import { SITE_URL, SITE_NAME } from '@/lib/seo/site'

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('connections')
    .select('title, region:regions(name)')
    .eq('id', id)
    .single()

  if (!data) return { title: `${SITE_NAME} - 代購比價平台` }

  const region = data.region as unknown as { name: string } | null
  const heading = data.title?.trim() || `${region?.name ?? ''}代購連線`
  const title = `${heading} - ${SITE_NAME}`

  return {
    title,
    alternates: { canonical: `${SITE_URL}/connections/${id}` },
  }
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ConnectionDetailPageClient params={params} />
}
