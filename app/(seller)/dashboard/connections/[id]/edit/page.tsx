'use client'

import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!connection) return null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold font-heading">編輯連線公告</h1>
      </div>
      <ConnectionForm mode="edit" initialData={connection} />
    </div>
  )
}
