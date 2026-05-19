import type { Metadata } from 'next'
import SearchPageClient from './page-client'

export const metadata: Metadata = {
  title: '搜尋代購 · Kozukase',
  description: '搜尋日本代購商品、比較賣家與價格',
  alternates: { canonical: 'https://kozukase.com/search' },
}

export default function Page() {
  return <SearchPageClient />
}
