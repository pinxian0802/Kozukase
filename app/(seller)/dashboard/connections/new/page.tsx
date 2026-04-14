'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConnectionForm } from '@/components/connection/connection-form'

export default function NewConnectionPage() {
  const router = useRouter()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold font-heading">新增連線公告</h1>
      </div>
      <ConnectionForm mode="create" />
    </div>
  )
}
