'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConnectionForm } from '@/components/connection/connection-form'

export default function NewConnectionPage() {
  const router = useRouter()

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          新增連線公告
        </h1>
      </div>

      <Card>
        <CardContent className="p-6 sm:p-8">
          <ConnectionForm mode="create" />
        </CardContent>
      </Card>
    </div>
  )
}
