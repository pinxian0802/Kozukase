import type { Metadata } from 'next'
import ConnectionsPageClient from './page-client'
import { SITE_URL } from '@/lib/seo/site'

export const metadata: Metadata = {
  title: '尋找心儀的代購連線 - Kozukase',
  description: '查看即將出發的代購連線，找到你需要的代購行程。',
  alternates: { canonical: `${SITE_URL}/connections` },
}

export default function Page() {
  return <ConnectionsPageClient />
}
