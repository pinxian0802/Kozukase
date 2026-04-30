'use client'

import Link from 'next/link'
import { Plus, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { trpc } from '@/lib/trpc/client'
import { formatDate } from '@/lib/utils/format'
import { toast } from 'sonner'

const statusLabels: Record<string, string> = {
  active: '進行中',
  ended: '已結束',
  pending_approval: '待審核',
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  ended: 'bg-gray-100 text-gray-600',
  pending_approval: 'bg-blue-100 text-blue-700',
}

export default function SellerConnectionsPage() {
  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.connection.myConnections.useQuery({})

  const endConnection = trpc.connection.end.useMutation({
    onSuccess: () => { toast.success('已結束連線'); utils.connection.invalidate() },
    onError: (err) => toast.error(err.message),
  })

  const reactivate = trpc.connection.reactivate.useMutation({
    onSuccess: () => { toast.success('已重新申請'); utils.connection.invalidate() },
    onError: (err) => toast.error(err.message),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading">連線管理</h1>
        <Button render={<Link href="/dashboard/connections/new" />}><Plus className="mr-1 h-4 w-4" />新增連線</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      ) : data && data.length > 0 ? (
        <div className="space-y-3">
          {data.map((conn: any) => (
            <div key={conn.id} className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium">
                    {conn.region?.name}
                    {conn.locations && conn.locations.length > 0 ? ` - ${conn.locations.slice(0, 2).join('・')}${conn.locations.length > 2 ? ` +${conn.locations.length - 2}` : ''}` : ''}
                  </p>
                  <Badge variant="secondary" className={statusColors[conn.status]}>{statusLabels[conn.status]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{formatDate(conn.start_date)} ~ {formatDate(conn.end_date)}</p>
                {conn.shipping_date && (
                  <p className="text-sm text-muted-foreground">預計出貨：{formatDate(conn.shipping_date)}</p>
                )}
                {conn.description && <p className="text-sm text-muted-foreground mt-1">{conn.description}</p>}
                {conn.billing_method && <p className="text-sm text-muted-foreground mt-1">{conn.billing_method}</p>}
              </div>
              <div className="flex gap-2">
                {conn.status === 'active' && (
                  <>
                    <Button size="sm" variant="outline" render={<Link href={`/dashboard/connections/${conn.id}/edit`} />}>編輯</Button>
                    <Button size="sm" variant="destructive" onClick={() => endConnection.mutate({ id: conn.id })} disabled={endConnection.isPending}>結束</Button>
                  </>
                )}
                {conn.status === 'ended' && conn.ended_reason === 'admin' && (
                  <Button size="sm" onClick={() => reactivate.mutate({ id: conn.id })} disabled={reactivate.isPending}>重新申請</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Globe} title="還沒有連線公告" description="新增連線公告讓買家知道你的代購行程！" />
      )}
    </div>
  )
}
