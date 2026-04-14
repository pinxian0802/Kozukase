'use client'

import { useState } from 'react'
import { Flag, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/empty-state'
import { trpc } from '@/lib/trpc/client'
import { formatRelativeTime } from '@/lib/utils/format'
import { toast } from 'sonner'

export default function AdminReportsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [resolveId, setResolveId] = useState<string | null>(null)
  const [adminNote, setAdminNote] = useState('')
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

  const getTargetLabel = (report: any) => {
    if (report.listing_id) return `Listing`
    if (report.review_id) return `評價`
    if (report.connection_id) return `連線`
    if (report.seller_id) return `賣家`
    return '未知'
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">檢舉處理</h1>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="pending">待處理</TabsTrigger>
          <TabsTrigger value="resolved">已解決</TabsTrigger>
          <TabsTrigger value="dismissed">已駁回</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      ) : data?.items && data.items.length > 0 ? (
        <div className="space-y-3">
          {data.items.map((report: any) => (
            <div key={report.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">{getTargetLabel(report)}</Badge>
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(report.created_at)}</span>
                  </div>
                  <p className="text-sm font-medium">{report.reason}</p>
                  {report.description && <p className="text-sm text-muted-foreground mt-1">{report.description}</p>}
                  {report.admin_note && (
                    <p className="text-xs text-muted-foreground mt-2 border-t pt-2">管理員備註：{report.admin_note}</p>
                  )}
                </div>
                {report.status === 'pending' && (
                  <div className="flex gap-2">
                    <Dialog open={resolveId === report.id} onOpenChange={(open) => { if (!open) setResolveId(null) }}>
                      <DialogTrigger nativeButton render={<Button size="sm" onClick={() => setResolveId(report.id)} />}>
                        處理
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>處理檢舉</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div>
                            <Label>管理員備註（選填）</Label>
                            <Textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="備註..." className="mt-1" />
                          </div>
                          <div className="flex gap-2">
                            <Button className="flex-1" onClick={() => resolve.mutate({ id: report.id, status: 'resolved', admin_note: adminNote || undefined })} disabled={resolve.isPending}>
                              <CheckCircle className="mr-1 h-3 w-3" />解決
                            </Button>
                            <Button variant="outline" className="flex-1" onClick={() => resolve.mutate({ id: report.id, status: 'dismissed', admin_note: adminNote || undefined })} disabled={resolve.isPending}>
                              <XCircle className="mr-1 h-3 w-3" />駁回
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Flag} title="沒有檢舉" description={statusFilter === 'pending' ? '目前沒有待處理的檢舉' : '沒有符合的檢舉記錄'} />
      )}
    </div>
  )
}
