import type { Metadata } from 'next'
import WishesPageClient from './page-client'
import { SITE_URL } from '@/lib/seo/site'

export const metadata: Metadata = {
  title: '代購許願列表 - Kozukase',
  description: '看看大家正在許願的代購商品，或發出你自己的許願。',
  alternates: { canonical: `${SITE_URL}/wishes` },
}

export default function Page() {
  return <WishesPageClient />
}
