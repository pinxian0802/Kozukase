'use client'

import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ConnectionForm } from '@/components/connection/connection-form'
import { trpc } from '@/lib/trpc/client'

export default function EditConnectionPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  // We'll use myConnections and find the one
  const { data, isLoading } = trpc.connection.myConnections.useQuery({})
  const connection = data?.find((c: any) => c.id === id)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!connection) return null

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          編輯連線公告
        </h1>
      </div>
      <Card className="ring-0 shadow-sm">
        <CardContent className="p-6 sm:p-8">
          <ConnectionForm mode="edit" initialData={connection} />
        </CardContent>
      </Card>
    </div>
  )
}
