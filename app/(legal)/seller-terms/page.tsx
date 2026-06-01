import type { Metadata } from 'next'
import { LegalDocView } from '@/components/legal/legal-doc-view'
import { loadLegalDoc } from '@/lib/legal/load-doc'

export const metadata: Metadata = {
  title: '賣家服務條款 | Kozukase',
  description: 'Kozukase 平台之賣家服務條款。',
}

export default async function SellerTermsPage() {
  const content = await loadLegalDoc('seller-terms.md')
  return <LegalDocView title="賣家服務條款" content={content} />
}
