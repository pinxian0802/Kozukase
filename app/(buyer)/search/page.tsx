import type { Metadata } from 'next'
import SearchPageClient from './page-client'
import { SITE_URL } from '@/lib/seo/site'

export const metadata: Metadata = {
  title: '尋找心儀的商品代購 - Kozukase',
  description: '搜尋代購商品、比較賣家與價格',
  alternates: { canonical: `${SITE_URL}/search` },
}

export default function Page() {
  return <SearchPageClient />
}
