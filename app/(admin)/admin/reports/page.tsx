'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs } from '@/components/ui/tabs'
import { FilterTabsList } from '@/components/shared/filter-tabs-list'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/empty-state'
import { trpc } from '@/lib/trpc/client'
import { formatRelativeTime, formatDate } from '@/lib/utils/format'
import { toast } from 'sonner'

export default function AdminReportsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [resolveId, setResolveId] = useState<string | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [reviewText, setReviewText] = useState<string | null>(null)
  const utils = trpc.useUtils()

  const status = statusFilter as any
  const { data, isLoading } = trpc.admin.listReports.useQuery({ status, limit: 50 })

  const resolve = trpc.admin.resolveReport.useMutation({
    onSuccess: () => {
      toast.success('已處理')
      setResolveId(null)
      setAdminNote('')
      utils.admin.listReports.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  const getTypeLabel = (report: any) => {
    if (report.listing_id) return '商品'
    if (report.review_id) return '評價'
    if (report.connection_id) return '連線'
    if (report.seller_id) return '賣家'
    return '未知'
  }

  const getEnforceLabel = (report: any) => {
    if (report.listing_id) return '下架並結案'
    if (report.connection_id) return '結束並結案'
    if (report.review_id) return '隱藏並結案'
    if (report.seller_id) return '停權並結案'
    return '處理並結案'
  }

  const renderTarget = (report: any) => {
    if (report.listing_id && report.listing) {
      const name = report.listing.product?.name ?? '代購商品'
      const seller = report.listing.seller?.name
      return (
        <Link href={`/listings/${report.listing_id}`} target="_blank" className="hover:underline">
          <p className="font-medium text-foreground">{name}</p>
          {seller && <p className="text-xs text-muted-foreground">{seller}</p>}
        </Link>
      )
    }
    if (report.connection_id && report.connection) {
      const seller = report.connection.seller?.name
      return (
        <Link href={`/connections/${report.connection_id}`} target="_blank" className="hover:underline">
          <p className="font-medium text-foreground">{report.connection.title}</p>
          {seller && <p className="text-xs text-muted-foreground">{seller}</p>}
        </Link>
      )
    }
    if (report.seller_id && report.reported_seller) {
      return (
        <Link href={`/sellers/${report.seller_id}`} target="_blank" className="hover:underline">
          <p className="font-medium text-foreground">{report.reported_seller.name}</p>
        </Link>
      )
    }
    if (report.review_id && report.review) {
      return (
        <button
          onClick={() => setReviewText(report.review.comment)}
          className="text-left text-muted-foreground line-clamp-2 hover:text-foreground hover:underline"
        >
          "{report.review.comment}"
        </button>
      )
    }
    return <span className="text-muted-foreground">—</span>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">檢舉處理</h1>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <FilterTabsList items={[
          { value: 'pending', label: '待處理' },
          { value: 'resolved', label: '已解決' },
          { value: 'dismissed', label: '已駁回' },
        ]} />
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      ) : data?.items && data.items.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">類型</th>
                <th className="px-4 py-3 font-medium">被檢舉對象</th>
                <th className="px-4 py-3 font-medium">檢舉人</th>
                <th className="px-4 py-3 font-medium">原因</th>
                <th className="px-4 py-3 font-medium">時間</th>
                <th className="px-4 py-3 font-medium text-right">
                  {statusFilter === 'pending' ? '操作' : '處理結果'}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((report: any) => (
                <tr key={report.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <Badge variant="outline">{getTypeLabel(report)}</Badge>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    {renderTarget(report)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {report.reporter?.display_name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{report.reason}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatRelativeTime(report.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {report.status === 'pending' ? (
                      <Dialog open={resolveId === report.id} onOpenChange={(open) => { if (!open) setResolveId(null) }}>
                        <DialogTrigger nativeButton render={<Button size="sm" onClick={() => setResolveId(report.id)} />}>
                          處理
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>處理檢舉</DialogTitle></DialogHeader>
                          <div className="space-y-3">
                            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                              <p><span className="text-muted-foreground">類型：</span>{getTypeLabel(report)}</p>
                              <p><span className="text-muted-foreground">原因：</span>{report.reason}</p>
                            </div>
                            <div>
                              <Label>處理原因</Label>
                              <Textarea
                                value={adminNote}
                                onChange={(e) => setAdminNote(e.target.value)}
                                placeholder="請填寫處理原因（將作為下架／停權理由通知對方；選擇忽略時可留空）"
                                className="mt-1"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="destructive"
                                className="flex-1"
                                onClick={() => resolve.mutate({ id: report.id, action: 'takedown', admin_note: adminNote })}
                                disabled={resolve.isPending || !adminNote.trim()}
                              >
                                <CheckCircle className="mr-1 h-3 w-3" />{getEnforceLabel(report)}
                              </Button>
                              <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => resolve.mutate({ id: report.id, action: 'dismiss', admin_note: adminNote || undefined })}
                                disabled={resolve.isPending}
                              >
                                <XCircle className="mr-1 h-3 w-3" />忽略
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <div className="text-right text-xs text-muted-foreground space-y-1">
                        {report.admin_note && (
                          <p className="max-w-[180px] ml-auto">{report.admin_note}</p>
                        )}
                        {report.resolved_at && (
                          <p>{formatDate(report.resolved_at)}</p>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon="report" title="沒有檢舉" description={statusFilter === 'pending' ? '目前沒有待處理的檢舉' : '沒有符合的檢舉記錄'} />
      )}

      {/* 評論全文彈窗 */}
      <Dialog open={!!reviewText} onOpenChange={(open) => { if (!open) setReviewText(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>評論全文</DialogTitle></DialogHeader>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{reviewText}</p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
