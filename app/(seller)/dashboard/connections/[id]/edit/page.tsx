'use client'

import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConnectionForm } from '@/components/connection/connection-form'
import { ConnectionFormSkeleton } from '@/components/dashboard/connection-form-skeleton'
import { trpc } from '@/lib/trpc/client'

export default function EditConnectionPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  // We'll use myConnections and find the one
  const { data, isLoading } = trpc.connection.myConnections.useQuery({})
  const connection = data?.find((c: any) => c.id === id)

  if (isLoading) {
    return <ConnectionFormSkeleton />
  }

  if (!connection) return null

  const adminTakenDown = (connection as any).ended_reason === 'admin' && !!(connection as any).admin_note
  const selfEnded = (connection as any).status === 'ended' && !adminTakenDown

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3 sm:items-start">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-heading text-[15px] font-semibold tracking-tight text-foreground sm:text-4xl">
          編輯連線公告
        </h1>
      </div>
      {adminTakenDown && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>此連線因「{(connection as any).admin_note}」已被管理員中止，請修改後重新送出審核。</p>
        </div>
      )}
      {selfEnded && (
        <div className="flex items-start gap-2 rounded-lg border border-border-soft bg-muted/50 p-3 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>此連線已結束，開始與結束日期已清空。請填寫新的日期後，按下方「重新上架」即可重新公開。</p>
        </div>
      )}

      <Card className="ring-0 shadow-sm">
        <CardContent className="px-4 py-4 sm:px-8 sm:py-5">
          <ConnectionForm mode="edit" initialData={connection} />
        </CardContent>
      </Card>
    </div>
  )
}
