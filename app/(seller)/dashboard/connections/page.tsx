'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DashboardListShell } from '@/components/dashboard/list-shell'
import { DashboardStatusDot } from '@/components/dashboard/status-dot'
import { DashboardThumbnailCell, type DashboardThumbnailImage } from '@/components/dashboard/thumbnail-cell'
import { trpc } from '@/lib/trpc/client'
import { formatDate } from '@/lib/utils/format'
import { toast } from 'sonner'

const statusLabels: Record<string, string> = {
  active: '進行中',
  ended: '已結束',
  pending_approval: '待審核',
}

const statusDotColors: Record<string, string> = {
  active: 'bg-green-500',
  ended: 'bg-gray-400',
  pending_approval: 'bg-red-500',
}

type ConnectionImage = { url: string; thumbnail_url?: string | null; sort_order: number }
type ConnectionItem = {
  id: string
  title: string | null
  status: string
  start_date: string
  end_date: string
  shipping_date?: string | null
  can_wish?: boolean | null
  region?: { id: string; name: string } | null
  connection_images?: ConnectionImage[] | null
}

function buildDisplayImages(conn: ConnectionItem): DashboardThumbnailImage[] {
  const sorted = [...(conn.connection_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  return sorted.map((img) => ({
    url: img.thumbnail_url ?? img.url,
    alt: conn.title ?? '連線圖片',
  }))
}

export default function SellerConnectionsPage() {
  const router = useRouter()
  const [status, setStatus] = useState<string>('all')
  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.connection.myConnections.useQuery({})

  const counts = {
    total: data?.length ?? 0,
    active: data?.filter((c) => c.status === 'active').length ?? 0,
    ended: data?.filter((c) => c.status === 'ended').length ?? 0,
    pending_approval: data?.filter((c) => c.status === 'pending_approval').length ?? 0,
  }

  const filtered: ConnectionItem[] =
    status === 'all'
      ? ((data ?? []) as ConnectionItem[])
      : ((data ?? []).filter((c) => c.status === status) as ConnectionItem[])

  const invalidate = () => utils.connection.invalidate()
  const endConnection = trpc.connection.end.useMutation({
    onSuccess: () => { toast.success('已結束連線'); invalidate() },
    onError: (err) => toast.error(err.message),
  })
  const reactivate = trpc.connection.reactivate.useMutation({
    onSuccess: () => { toast.success('已更新連線狀態'); invalidate() },
    onError: (err) => toast.error(err.message),
  })
  const deleteConnection = trpc.connection.delete.useMutation({
    onSuccess: () => { toast.success('已刪除連線'); invalidate() },
    onError: (err) => toast.error(err.message),
  })

  const isEmpty = !isLoading && filtered.length === 0
  const actionPending = endConnection.isPending || reactivate.isPending || deleteConnection.isPending

  const actionHandlers = (id: string) => ({
    onEnd: () => endConnection.mutate({ id }),
    onReactivate: () => reactivate.mutate({ id }),
    onDelete: () => deleteConnection.mutate({ id }),
  })

  return (
    <DashboardListShell
      title="連線管理"
      usageHint={`已使用 ${counts.total} / 5`}
      newButton={{ href: '/dashboard/connections/new', label: '新增連線' }}
      tabs={[
        { value: 'all', label: '全部', count: counts.total },
        { value: 'active', label: '進行中', count: counts.active },
        { value: 'ended', label: '已結束', count: counts.ended },
        { value: 'pending_approval', label: '待審核', count: counts.pending_approval },
      ]}
      currentTab={status}
      onTabChange={setStatus}
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyState={{ icon: Globe, title: '還沒有連線公告', description: '新增連線公告讓買家知道你的代購行程!' }}
    >
      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[96px]">圖片</TableHead>
              <TableHead>標題</TableHead>
              <TableHead>國家</TableHead>
              <TableHead>連線日期</TableHead>
              <TableHead>預計出貨</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead className="w-[200px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((conn) => {
              const displayImages = buildDisplayImages(conn)
              const handlers = actionHandlers(conn.id)
              return (
                <TableRow
                  key={conn.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/dashboard/connections/${conn.id}/edit`)}
                >
                  <TableCell>
                    <DashboardThumbnailCell
                      images={displayImages}
                      title={conn.title ?? '連線'}
                      fallbackIcon={Globe}
                    />
                  </TableCell>
                  <TableCell className="max-w-[28ch] truncate font-medium">
                    {conn.title || <span className="font-normal text-muted-foreground">--</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{conn.region?.name ?? '--'}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(conn.start_date)} ~ {formatDate(conn.end_date)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {conn.shipping_date ? formatDate(conn.shipping_date) : <span className="text-muted-foreground">--</span>}
                  </TableCell>
                  <TableCell>
                    <DashboardStatusDot
                      label={statusLabels[conn.status] ?? conn.status}
                      dotClassName={statusDotColors[conn.status]}
                    />
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <ConnectionActions
                      connectionId={conn.id}
                      connectionStatus={conn.status}
                      pending={actionPending}
                      {...handlers}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="lg:hidden space-y-3">
        {filtered.map((conn) => {
          const displayImages = buildDisplayImages(conn)
          const handlers = actionHandlers(conn.id)
          return (
            <div
              key={conn.id}
              className="rounded-xl bg-white p-3 shadow-sm cursor-pointer"
              onClick={() => router.push(`/dashboard/connections/${conn.id}/edit`)}
            >
              <div className="flex items-start gap-3 pb-3 border-b border-muted">
                <DashboardThumbnailCell
                  images={displayImages}
                  title={conn.title ?? '連線'}
                  fallbackIcon={Globe}
                  size={56}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="truncate font-semibold">{conn.title || '--'}</h3>
                  <DashboardStatusDot
                    label={statusLabels[conn.status] ?? conn.status}
                    dotClassName={statusDotColors[conn.status]}
                  />
                </div>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 py-3 text-sm">
                <span className="text-xs text-muted-foreground">國家</span>
                <span className="text-right truncate">{conn.region?.name ?? '--'}</span>
                <span className="text-xs text-muted-foreground">連線日期</span>
                <span className="text-right">{formatDate(conn.start_date)} ~ {formatDate(conn.end_date)}</span>
                <span className="text-xs text-muted-foreground">預計出貨</span>
                <span className="text-right">{conn.shipping_date ? formatDate(conn.shipping_date) : '--'}</span>
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                <ConnectionActions
                  connectionId={conn.id}
                  connectionStatus={conn.status}
                  pending={actionPending}
                  {...handlers}
                />
              </div>
            </div>
          )
        })}
      </div>
    </DashboardListShell>
  )
}

type ConnectionActionsProps = {
  connectionId: string
  connectionStatus: string
  pending: boolean
  onEnd: () => void
  onReactivate: () => void
  onDelete: () => void
}

function ConnectionActions({
  connectionId,
  connectionStatus,
  pending,
  onEnd,
  onReactivate,
  onDelete,
}: ConnectionActionsProps) {
  return (
    <div className="inline-flex flex-wrap gap-2 justify-end">
      <Button size="sm" variant="outline" render={<Link href={`/dashboard/connections/${connectionId}/edit`} />}>編輯</Button>
      {connectionStatus === 'active' && (
        <Button size="sm" variant="destructive" onClick={onEnd} disabled={pending}>結束</Button>
      )}
      {connectionStatus === 'ended' && (
        <>
          <Button size="sm" onClick={onReactivate} disabled={pending}>重新上架</Button>
          <Button size="sm" variant="destructive" onClick={onDelete} disabled={pending}>刪除</Button>
        </>
      )}
      {connectionStatus === 'pending_approval' && (
        <Badge variant="outline" className="h-8 px-3">等待審核結果</Badge>
      )}
    </div>
  )
}
