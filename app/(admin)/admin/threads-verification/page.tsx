'use client'

import { useState } from 'react'
import { BadgeCheck, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { FilterTabsList } from '@/components/shared/filter-tabs-list'
import { DatePicker } from '@/components/ui/date-picker'
import { EmptyState } from '@/components/shared/empty-state'
import { trpc } from '@/lib/trpc/client'
import { formatDate } from '@/lib/utils/format'
import { toast } from 'sonner'

export default function AdminThreadsVerificationPage() {
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const utils = trpc.useUtils()

  const { data: pending, isLoading: pendingLoading } = trpc.admin.listThreadsVerifications.useQuery()
  const { data: history, isLoading: historyLoading } = trpc.admin.listThreadsVerificationHistory.useQuery({
    from: from || undefined,
    to: to || undefined,
  })

  const approve = trpc.admin.approveThreadsVerification.useMutation({
    onSuccess: () => {
      toast.success('已通過')
      utils.admin.listThreadsVerifications.invalidate()
      utils.admin.listThreadsVerificationHistory.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  const reject = trpc.admin.rejectThreadsVerification.useMutation({
    onSuccess: () => {
      toast.success('已退回')
      setRejectId(null)
      setRejectReason('')
      utils.admin.listThreadsVerifications.invalidate()
      utils.admin.listThreadsVerificationHistory.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">Thread 驗證</h1>

      <Tabs defaultValue="pending">
        <FilterTabsList items={[
          { value: 'pending', label: '待審核', count: pending?.length },
          { value: 'history', label: '審核紀錄' },
        ]} />

        <div className="mt-6">
          {/* ── 待審核 ── */}
          <TabsContent value="pending">
            {pendingLoading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
            ) : pending && pending.length > 0 ? (
              <div className="space-y-2">
                {pending.map((req) => (
                  <div key={req.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex-1">
                      <p className="font-medium">{req.seller_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Threads 帳號{' '}
                        <a
                          href={`https://www.threads.net/@${req.threads_username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-foreground hover:underline"
                        >@{req.threads_username}</a>
                        {' · '}送出於 {formatDate(req.created_at)}
                      </p>
                      <p className="mt-1 text-sm">
                        驗證碼 <span className="font-mono font-bold tracking-widest">{req.code}</span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => approve.mutate({ id: req.id })} disabled={approve.isPending}>
                        <Check className="mr-1 h-3 w-3" />通過
                      </Button>
                      <Dialog open={rejectId === req.id} onOpenChange={(open) => { if (!open) { setRejectId(null); setRejectReason('') } }}>
                        <DialogTrigger nativeButton render={<Button size="sm" variant="destructive" onClick={() => setRejectId(req.id)} />}>
                          <X className="mr-1 h-3 w-3" />退回
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>退回驗證申請</DialogTitle></DialogHeader>
                          <div className="space-y-3">
                            <p className="text-sm">確定要退回「{req.seller_name}」的 Threads 驗證?賣家會收到通知並可重新申請。</p>
                            <div>
                              <Label>退回原因（選填）</Label>
                              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="例如:收件匣找不到這組驗證碼…" className="mt-1" />
                            </div>
                            <Button variant="destructive" className="w-full" onClick={() => reject.mutate({ id: req.id, reason: rejectReason.trim() || undefined })} disabled={reject.isPending}>
                              確認退回
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={BadgeCheck} title="目前沒有待審核的 Threads 驗證" />
            )}
          </TabsContent>

          {/* ── 審核紀錄 ── */}
          <TabsContent value="history">
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div className="w-40">
                <Label className="text-xs text-muted-foreground">從(審核日期)</Label>
                <DatePicker value={from} onValueChange={setFrom} placeholder="開始日期" className="mt-1" />
              </div>
              <div className="w-40">
                <Label className="text-xs text-muted-foreground">到</Label>
                <DatePicker value={to} onValueChange={setTo} placeholder="結束日期" className="mt-1" />
              </div>
              {(from || to) && (
                <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo('') }}>
                  清除篩選
                </Button>
              )}
            </div>

            {historyLoading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
            ) : history && history.length > 0 ? (
              <div className="space-y-2">
                {history.map((req) => (
                  <div key={req.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{req.seller_name}</p>
                        {req.status === 'approved' ? (
                          <Badge variant="secondary">已通過</Badge>
                        ) : (
                          <Badge variant="destructive">已退回</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Threads 帳號{' '}
                        <a
                          href={`https://www.threads.net/@${req.threads_username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-foreground hover:underline"
                        >@{req.threads_username}</a>
                        {req.reviewed_at && <>{' · '}審核於 {formatDate(req.reviewed_at)}</>}
                      </p>
                      {req.status === 'rejected' && req.reject_reason && (
                        <p className="mt-1 text-sm text-muted-foreground">退回原因:{req.reject_reason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={BadgeCheck} title={(from || to) ? '這段期間沒有審核紀錄' : '還沒有審核紀錄'} />
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
