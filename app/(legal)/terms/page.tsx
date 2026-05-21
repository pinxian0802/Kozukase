import type { Metadata } from 'next'
import { LegalDocView } from '@/components/legal/legal-doc-view'
import { loadLegalDoc } from '@/lib/legal/load-doc'

export const metadata: Metadata = {
  title: '使用者條款 | Kozukase',
  description: 'Kozukase 平台之使用者條款。',
}

export default async function TermsPage() {
  const content = await loadLegalDoc('terms-of-service.md')
  return <LegalDocView title="使用者條款" content={content} />
}
