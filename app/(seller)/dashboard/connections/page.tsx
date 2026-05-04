'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { Calendar, Clock3, CreditCard, ExternalLink, FileText, Globe, Images, MapPin, Maximize2, Plus, Tag } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { SafeExternalLink } from '@/components/shared/safe-external-link'
import { ImageLightbox } from '@/components/shared/image-lightbox'
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

const connectionGridClass = 'grid gap-5 lg:grid-cols-[minmax(0,3.6fr)_minmax(0,2.7fr)_minmax(0,2.8fr)_minmax(0,1.6fr)_minmax(0,1.1fr)_max-content]'

type ConnectionImage = {
  url: string
  alt?: string
}

function ConnectionThumbnail({ images, title }: { images: ConnectionImage[]; title: string }) {
  const [viewerOpen, setViewerOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  if (images.length === 0) {
    return (
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border bg-muted/40">
        <div className="flex h-full items-center justify-center text-muted-foreground/50">
          <Globe className="h-7 w-7" />
        </div>
      </div>
    )
  }

  const currentIndex = Math.min(activeIndex, Math.max(images.length - 1, 0))
  const activeImage = images[currentIndex] ?? images[0]
  const isLocalPreviewUrl = activeImage.url.startsWith('blob:') || activeImage.url.startsWith('data:')

  return (
    <>
      <button
        type="button"
        onClick={() => setViewerOpen(true)}
        className="group relative h-24 cursor-pointer w-24 shrink-0 overflow-hidden rounded-2xl border bg-muted/40 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label={`預覽 ${title}`}
      >
        <Image
          src={activeImage.url}
          alt={activeImage.alt ?? title}
          fill
          sizes="96px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          unoptimized={isLocalPreviewUrl}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="inline-flex min-w-0 items-center gap-1 truncate">
            <Images className="h-3.5 w-3.5 shrink-0" />
            {images.length}
          </span>
          <Maximize2 className="h-3.5 w-3.5 shrink-0" />
        </div>
      </button>

      <ImageLightbox
        open={viewerOpen}
        images={images}
        activeIndex={currentIndex}
        onActiveIndexChange={setActiveIndex}
        onOpenChange={setViewerOpen}
      />
    </>
  )
}

export default function SellerConnectionsPage() {
  const [status, setStatus] = useState<string>('all')
  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.connection.myConnections.useQuery({})
  type SellerConnection = NonNullable<typeof data>[number] & { post_link?: string | null }

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
            <span className="justify-self-start">標題 / 地點</span>
            <span className="justify-self-start">說明</span>
            <span className="justify-self-start">連線日期</span>
            <span className="justify-self-start">預計出貨 / 計費方式</span>
            <span className="justify-self-start">連結</span>
            <span className="justify-self-end text-center">操作</span>
          </div>

          {filteredConnections.map((conn: SellerConnection) => {
            const sortedImages = [...(conn.connection_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)
            const displayImages = sortedImages.map((image) => ({
              url: image.thumbnail_url ?? image.url,
              alt: conn.title ?? '連線圖片',
            }))
            const regionName = conn.region?.name ?? '--'
            const visibleLocations = conn.locations?.slice(0, 2) ?? []
            const extraLocationCount = (conn.locations?.length ?? 0) - 2
            const brandNames = (conn.connection_brands ?? []).map((cb: { brand_id: string; brand?: { id: string; name: string } | null }) => cb.brand?.name).filter(Boolean) as string[]
            const visibleBrands = brandNames.slice(0, 2)
            const extraBrandCount = brandNames.length - 2
            const postLink = conn.post_link

            return (
              <div
                key={conn.id}
                className={`overflow-hidden rounded-[28px] border p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)] transition-colors ${rowStyles[conn.status] ?? 'border-border bg-white'} ${conn.status === 'ended' ? 'opacity-85' : ''}`}
              >
                <div className={`${connectionGridClass} lg:items-center`}>
                  <div className="flex items-center min-w-0 gap-4">
                    <ConnectionThumbnail images={displayImages} title={conn.title ?? '--'} />

                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className={statusColors[conn.status]}>{statusLabels[conn.status]}</Badge>
                        {conn.status === 'pending_approval' && (
                          <Badge variant="outline">審核中</Badge>
                        )}
                      </div>
                      <h2 className="truncate text-xl font-semibold text-foreground">
                        {conn.title ?? <span className="font-normal text-muted-foreground">--</span>}
                      </h2>
                      <div className="grid gap-1 text-sm text-muted-foreground">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0">國家</span>
                          <span className="min-w-0 truncate font-medium text-foreground/85">{regionName}</span>
                        </div>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0">地點</span>
                          <div className="flex min-w-0 items-center gap-1">
                            <span className="min-w-0 truncate font-medium text-foreground/85">
                              {visibleLocations.length > 0 ? visibleLocations.join('、') : <span className="text-muted-foreground">--</span>}
                            </span>
                            {extraLocationCount > 0 && (
                              <span className="shrink-0 text-xs text-muted-foreground">+{extraLocationCount}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl bg-background/70 p-3 min-w-0 lg:bg-transparent lg:p-0">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />說明
                      </div>
                      <p className="line-clamp-2 text-sm text-foreground">
                        {conn.description || <span className="text-muted-foreground">--</span>}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground">
                        <CreditCard className="h-3.5 w-3.5" />計費方式
                      </p>
                      <p className="line-clamp-2 text-sm text-foreground">{conn.billing_method || <span className="text-muted-foreground">--</span>}</p>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl bg-background/70 p-3 min-w-0 lg:bg-transparent lg:p-0">
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />連線日期
                      </p>
                      <p className="whitespace-nowrap text-sm text-foreground">{formatDate(conn.start_date)} ~ {formatDate(conn.end_date)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" />預計出貨
                      </p>
                      <p className="whitespace-nowrap text-sm text-foreground">{conn.shipping_date ? formatDate(conn.shipping_date) : <span className="text-muted-foreground">--</span>}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground">
                        <Tag className="h-3.5 w-3.5" />品牌
                      </p>
                      <div className="flex min-w-0 items-center gap-1">
                        <span className="min-w-0 truncate text-sm text-foreground">
                          {visibleBrands.length > 0 ? visibleBrands.join('、') : <span className="text-muted-foreground">--</span>}
                        </span>
                        {extraBrandCount > 0 && (
                          <span className="shrink-0 text-xs text-muted-foreground">+{extraBrandCount}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 flex items-center rounded-2xl bg-background/70 p-3 lg:bg-transparent lg:p-0 lg:self-center">
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground">
                       貼文 / 群組連結
                      </p>
                      {postLink ? (
                        <SafeExternalLink
                          href={postLink}
                          variant="outline"
                          size="sm"
                          className="w-full justify-center"
                        >
                          查看連結
                          <ExternalLink className="h-3.5 w-3.5" />
                        </SafeExternalLink>
                      ) : (
                        <p className="truncate text-sm text-muted-foreground">--</p>
                      )}
                  </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 justify-self-end lg:flex-col lg:items-end lg:justify-self-end">
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
