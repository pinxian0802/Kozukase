import type { Metadata } from 'next'
import { LegalDocView } from '@/components/legal/legal-doc-view'
import { loadLegalDoc } from '@/lib/legal/load-doc'

export const metadata: Metadata = {
  title: '隱私權政策 | Kozukase',
  description: 'Kozukase 平台之隱私權政策。',
}

export default async function PrivacyPage() {
  const content = await loadLegalDoc('privacy-policy.md')
  return <LegalDocView title="隱私權政策" content={content} />
}
