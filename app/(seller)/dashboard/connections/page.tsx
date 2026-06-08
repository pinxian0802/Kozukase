'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, ExternalLink, MoreHorizontal, MoreVertical } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DashboardListShell } from '@/components/dashboard/list-shell'
import { DashboardStatusDot } from '@/components/dashboard/status-dot'
import { DashboardThumbnailCell, type DashboardThumbnailImage } from '@/components/dashboard/thumbnail-cell'
import { SafeExternalLink } from '@/components/shared/safe-external-link'
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
  start_date: string | null
  end_date: string | null
  shipping_date?: string | null
  can_wish?: boolean | null
  post_link?: string | null
  region?: { id: string; name: string } | null
  connection_images?: ConnectionImage[] | null
  ended_reason?: string | null
  admin_note?: string | null
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
  const deleteConnection = trpc.connection.delete.useMutation({
    onSuccess: () => { toast.success('已刪除連線'); invalidate() },
    onError: (err) => toast.error(err.message),
  })

  const isEmpty = !isLoading && filtered.length === 0
  const actionPending = endConnection.isPending || deleteConnection.isPending

  const actionHandlers = (id: string) => ({
    onEnd: () => endConnection.mutate({ id }),
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
              <TableHead className="w-[120px] text-center">貼文/群組</TableHead>
              <TableHead className="w-[120px] text-left">操作</TableHead>
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
                  <TableCell className="max-w-[28ch] font-medium">
                    <span className="line-clamp-2">
                      {conn.title || <span className="font-normal text-muted-foreground">--</span>}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{conn.region?.name ?? '--'}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex flex-col items-center leading-tight">
                      <span>{formatDate(conn.start_date)}</span>
                      <span className="text-muted-foreground">~</span>
                      <span>{formatDate(conn.end_date)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {conn.shipping_date ? formatDate(conn.shipping_date) : <span className="text-muted-foreground">--</span>}
                  </TableCell>
                  <TableCell>
                    <DashboardStatusDot
                      label={statusLabels[conn.status] ?? conn.status}
                      dotClassName={statusDotColors[conn.status]}
                      warning={conn.ended_reason === 'admin' ? (conn.admin_note || '此連線已被管理員中止') : null}
                    />
                  </TableCell>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    {conn.post_link ? (
                      <SafeExternalLink
                        href={conn.post_link}
                        variant="outline"
                        size="sm"
                        aria-label="前往貼文或群組"
                        title="前往貼文／群組"
                      >
                        連結
                        <ExternalLink className="h-3.5 w-3.5" />
                      </SafeExternalLink>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
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

      <div className="lg:hidden space-y-1.5">
        {filtered.map((conn) => {
          const displayImages = buildDisplayImages(conn)
          const handlers = actionHandlers(conn.id)
          return (
            <div
              key={conn.id}
              className="rounded-lg border border-border-soft bg-white p-2.5 cursor-pointer"
              onClick={() => router.push(`/dashboard/connections/${conn.id}/edit`)}
            >
              <div className="flex items-start gap-2.5">
                <DashboardThumbnailCell
                  images={displayImages}
                  title={conn.title ?? '連線'}
                  fallbackIcon={Globe}
                  size={48}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium truncate leading-tight">{conn.title || '--'}</p>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                    {conn.region?.name && <span>{conn.region.name}</span>}
                    <span>{formatDate(conn.start_date)} ~ {formatDate(conn.end_date)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <DashboardStatusDot
                      label={statusLabels[conn.status] ?? conn.status}
                      dotClassName={statusDotColors[conn.status]}
                      warning={conn.ended_reason === 'admin' ? (conn.admin_note || '此連線已被管理員中止') : null}
                    />
                    {conn.can_wish && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">可許願</span>
                    )}
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <ConnectionActions
                    connectionId={conn.id}
                    connectionStatus={conn.status}
                    pending={actionPending}
                    {...handlers}
                  />
                </div>
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
  onDelete: () => void
}

function ConnectionActions({
  connectionId,
  connectionStatus,
  pending,
  onEnd,
  onDelete,
}: ConnectionActionsProps) {
  return (
    <div className="inline-flex items-center justify-end gap-2 max-md:gap-1">
      <Button size="xs" variant="outline" render={<Link href={`/dashboard/connections/${connectionId}/edit`} />}>編輯</Button>
      {connectionStatus === 'pending_approval' ? (
        <span aria-hidden className={buttonVariants({ variant: 'ghost', size: 'icon-xs', className: 'invisible md:hidden' })} />
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            nativeButton={false}
            disabled={pending}
            aria-label="更多操作"
            render={
              <span className={buttonVariants({ variant: 'ghost', size: 'icon-xs' })}>
                <MoreHorizontal className="hidden h-4 w-4 md:block" />
                <MoreVertical className="h-3.5 w-3.5 md:hidden" />
              </span>
            }
          />
          <DropdownMenuContent align="end">
            {connectionStatus === 'active' && (
              <DropdownMenuItem variant="destructive" onClick={onEnd}>結束</DropdownMenuItem>
            )}
            {connectionStatus === 'ended' && (
              <DropdownMenuItem variant="destructive" onClick={onDelete}>刪除</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>

  )
}
