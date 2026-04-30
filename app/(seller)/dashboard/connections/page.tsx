'use client'

import Image from 'next/image'
import { useState } from 'react'
import Link from 'next/link'
import { Calendar, Clock3, FileText, Globe, Images, MapPin, Plus } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

const rowStyles: Record<string, string> = {
  active: 'border-border bg-white',
  ended: 'border-border bg-white',
  pending_approval: 'border-border bg-white',
}

const connectionGridClass = 'grid gap-4 lg:grid-cols-[minmax(0,3.9fr)_minmax(160px,0.92fr)_minmax(168px,0.95fr)_minmax(180px,1fr)_minmax(124px,0.8fr)]'

export default function SellerConnectionsPage() {
  const [status, setStatus] = useState<string>('all')
  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.connection.myConnections.useQuery({})
  type SellerConnection = NonNullable<typeof data>[number]

  const counts = {
    total: data?.length ?? 0,
    active: data?.filter((conn) => conn.status === 'active').length ?? 0,
    ended: data?.filter((conn) => conn.status === 'ended').length ?? 0,
    pending_approval: data?.filter((conn) => conn.status === 'pending_approval').length ?? 0,
  }

  const filteredConnections = status === 'all'
    ? data ?? []
    : (data ?? []).filter((conn) => conn.status === status)

  const endConnection = trpc.connection.end.useMutation({
    onSuccess: () => { toast.success('已結束連線'); utils.connection.invalidate() },
    onError: (err) => toast.error(err.message),
  })

  const reactivate = trpc.connection.reactivate.useMutation({
    onSuccess: () => { toast.success('已更新連線狀態'); utils.connection.invalidate() },
    onError: (err) => toast.error(err.message),
  })

  const deleteConnection = trpc.connection.delete.useMutation({
    onSuccess: () => { toast.success('已刪除連線'); utils.connection.invalidate() },
    onError: (err) => toast.error(err.message),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">連線管理</h1>
          <p className="text-sm text-muted-foreground">已使用 {counts.total} / 5</p>
        </div>
        <Button render={<Link href="/dashboard/connections/new" />}><Plus className="mr-1 h-4 w-4" />新增連線</Button>
      </div>

      <Tabs value={status} onValueChange={setStatus}>
        <TabsList variant="line" className="flex-wrap w-full border-b border-border">
          <TabsTrigger value="all">全部 ({counts.total})</TabsTrigger>
          <TabsTrigger value="active">進行中 ({counts.active})</TabsTrigger>
          <TabsTrigger value="ended">已結束 ({counts.ended})</TabsTrigger>
          <TabsTrigger value="pending_approval">待審核 ({counts.pending_approval})</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-[28px]" />)}</div>
      ) : filteredConnections.length > 0 ? (
        <div className="space-y-4">
          <div className={`hidden items-center gap-4 px-4 text-xs font-medium tracking-[0.18em] text-muted-foreground/80 lg:${connectionGridClass}`}>
            <span className="justify-self-start">連線資訊</span>
            <span className="justify-self-start">地點摘要</span>
            <span className="justify-self-start">時間安排</span>
            <span className="justify-self-start">補充資訊</span>
            <span className="w-24 justify-self-end text-center">操作</span>
          </div>

          {filteredConnections.map((conn: SellerConnection) => {
            const firstImage = [...(conn.connection_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]
            const imageUrl = firstImage?.thumbnail_url ?? firstImage?.url ?? null
            const locationSummary = conn.locations && conn.locations.length > 0
              ? `${conn.locations.slice(0, 2).join('・')}${conn.locations.length > 2 ? ` +${conn.locations.length - 2}` : ''}`
              : '未設定城市'

            return (
              <div
                key={conn.id}
                className={`overflow-hidden rounded-[28px] border p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)] transition-colors ${rowStyles[conn.status] ?? 'border-border bg-white'} ${conn.status === 'ended' ? 'opacity-85' : ''}`}
              >
                <div className={`${connectionGridClass} lg:items-center`}>
                  <div className="flex min-w-0 gap-4">
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border bg-muted/40">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={conn.region?.name ?? '連線圖片'}
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground/50">
                          <Globe className="h-7 w-7" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 space-y-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className={statusColors[conn.status]}>{statusLabels[conn.status]}</Badge>
                          {conn.status === 'pending_approval' && (
                            <Badge variant="outline">審核中</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">建立於 {formatDate(conn.created_at)}</span>
                        </div>
                        <h2 className="truncate text-lg font-semibold text-foreground">
                          {conn.region?.name ?? '未設定國家'}
                        </h2>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{locationSummary}</span>
                          <span className="inline-flex items-center gap-1"><Images className="h-3.5 w-3.5" />{conn.connection_images?.length ?? 0} 張圖片</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl bg-background/70 p-3 lg:bg-transparent lg:p-0">
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />地區
                      </p>
                      <p className="text-sm font-medium text-foreground">{conn.region?.name ?? '未設定'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground">城市</p>
                      <p className="text-sm text-foreground/80">{locationSummary}</p>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl bg-background/70 p-3 lg:bg-transparent lg:p-0">
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />連線日期
                      </p>
                      <p className="text-sm font-medium text-foreground">{formatDate(conn.start_date)} ~ {formatDate(conn.end_date)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" />預計出貨
                      </p>
                      <p className="text-sm text-foreground/80">{conn.shipping_date ? formatDate(conn.shipping_date) : '未設定'}</p>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl bg-background/70 p-3 lg:bg-transparent lg:p-0">
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />說明
                      </p>
                      <p className="line-clamp-3 text-sm text-foreground/80">
                        {conn.description ? conn.description : '未填寫連線說明'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground">結算方式</p>
                      <p className="line-clamp-2 text-sm text-foreground/80">{conn.billing_method ? conn.billing_method : '未設定'}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end">
                    <Button size="sm" variant="outline" className="min-w-24" render={<Link href={`/dashboard/connections/${conn.id}/edit`} />}>編輯</Button>
                    {conn.status === 'active' && (
                      <Button size="sm" variant="destructive" className="min-w-24" onClick={() => endConnection.mutate({ id: conn.id })} disabled={endConnection.isPending}>結束</Button>
                    )}
                    {conn.status === 'ended' && (
                      <>
                        <Button size="sm" className="min-w-24" onClick={() => reactivate.mutate({ id: conn.id })} disabled={reactivate.isPending}>重新上架</Button>
                        <Button size="sm" variant="destructive" className="min-w-24" onClick={() => deleteConnection.mutate({ id: conn.id })} disabled={deleteConnection.isPending}>刪除</Button>
                      </>
                    )}
                    {conn.status === 'pending_approval' && (
                      <Badge variant="outline" className="h-8 px-3">等待審核結果</Badge>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState icon={Globe} title="還沒有連線公告" description="新增連線公告讓買家知道你的代購行程！" />
      )}
    </div>
  )
}
