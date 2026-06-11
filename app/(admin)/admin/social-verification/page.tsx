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
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { EmptyState } from '@/components/shared/empty-state'
import { trpc } from '@/lib/trpc/client'
import { formatDate } from '@/lib/utils/format'
import { toast } from 'sonner'

type PendingRow = {
  id: string
  seller_name: string
  code: string
  created_at: string
  account: string
}

type HistoryRow = {
  id: string
  seller_name: string
  account: string
  status: string
  source?: string | null
  reject_reason: string | null
  reviewed_at: string | null
}

type PanelProps = {
  platformLabel: string
  accountUrlPrefix: string
  showSource: boolean
  pending: PendingRow[] | undefined
  pendingLoading: boolean
  history: HistoryRow[] | undefined
  historyLoading: boolean
  from: string
  to: string
  onRangeChange: (range: { startDate: string; endDate: string }) => void
  clearRange: () => void
  onApprove: (id: string) => void
  approvePending: boolean
  onReject: (id: string, reason: string | undefined) => void
  rejectPending: boolean
}

function VerificationPanel(props: PanelProps) {
  const {
    platformLabel, accountUrlPrefix, showSource, pending, pendingLoading,
    history, historyLoading, from, to, onRangeChange, clearRange,
    onApprove, approvePending, onReject, rejectPending,
  } = props
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  return (
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
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">賣家</th>
                    <th className="px-4 py-3 font-medium">{platformLabel} 帳號</th>
                    <th className="px-4 py-3 font-medium">驗證碼</th>
                    <th className="px-4 py-3 font-medium">送出時間</th>
                    <th className="px-4 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((req) => (
                    <tr key={req.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3 font-medium">{req.seller_name}</td>
                      <td className="px-4 py-3">
                        <a href={`${accountUrlPrefix}${req.account}`} target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline">@{req.account}</a>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold tracking-widest">{req.code}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(req.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => onApprove(req.id)} disabled={approvePending}>
                            <Check className="mr-1 h-3 w-3" />通過
                          </Button>
                          <Dialog open={rejectId === req.id} onOpenChange={(open) => { if (!open) { setRejectId(null); setRejectReason('') } }}>
                            <DialogTrigger nativeButton render={<Button size="sm" variant="destructive" onClick={() => setRejectId(req.id)} />}>
                              <X className="mr-1 h-3 w-3" />退回
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader><DialogTitle>退回驗證申請</DialogTitle></DialogHeader>
                              <div className="space-y-3">
                                <p className="text-sm">確定要退回「{req.seller_name}」的 {platformLabel} 驗證?賣家會收到通知並可重新申請。</p>
                                <div>
                                  <Label>退回原因（選填）</Label>
                                  <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="例如:收件匣找不到這組驗證碼…" className="mt-1" />
                                </div>
                                <Button
                                  variant="destructive"
                                  className="w-full"
                                  onClick={() => { onReject(req.id, rejectReason.trim() || undefined); setRejectId(null); setRejectReason('') }}
                                  disabled={rejectPending}
                                >
                                  確認退回
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={BadgeCheck} title={`目前沒有待審核的 ${platformLabel} 驗證`} />
          )}
        </TabsContent>

        {/* ── 審核紀錄 ── */}
        <TabsContent value="history">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">審核日期</Label>
              <DateRangePicker
                startDate={from}
                endDate={to}
                onRangeChange={onRangeChange}
                className="mt-1"
              />
            </div>
            {(from || to) && (
              <Button variant="ghost" size="sm" onClick={clearRange}>
                清除篩選
              </Button>
            )}
          </div>

          {historyLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
          ) : history && history.length > 0 ? (
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">賣家</th>
                    <th className="px-4 py-3 font-medium">{platformLabel} 帳號</th>
                    <th className="px-4 py-3 font-medium">結果</th>
                    {showSource && <th className="px-4 py-3 font-medium">來源</th>}
                    <th className="px-4 py-3 font-medium">審核時間</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((req) => (
                    <tr key={req.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3 font-medium">{req.seller_name}</td>
                      <td className="px-4 py-3">
                        <a href={`${accountUrlPrefix}${req.account}`} target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline">@{req.account}</a>
                      </td>
                      <td className="px-4 py-3">
                        {req.status === 'approved'
                          ? <Badge variant="secondary">已通過</Badge>
                          : <Badge variant="destructive">已退回</Badge>}
                        {req.status === 'rejected' && req.reject_reason && (
                          <p className="text-xs text-muted-foreground mt-0.5">{req.reject_reason}</p>
                        )}
                      </td>
                      {showSource && (
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {req.source === 'auto' ? '🤖 自動' : req.source === 'manual' ? '👤 人工' : '—'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {req.reviewed_at ? formatDate(req.reviewed_at) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={BadgeCheck} title={(from || to) ? '這段期間沒有審核紀錄' : '還沒有審核紀錄'} />
          )}
        </TabsContent>
      </div>
    </Tabs>
  )
}

export default function AdminSocialVerificationPage() {
  const utils = trpc.useUtils()

  // Instagram
  const [igFrom, setIgFrom] = useState('')
  const [igTo, setIgTo] = useState('')
  const { data: igPending, isLoading: igPendingLoading } = trpc.admin.listIgVerifications.useQuery()
  const { data: igHistory, isLoading: igHistoryLoading } = trpc.admin.listIgVerificationHistory.useQuery({
    from: igFrom || undefined,
    to: igTo || undefined,
  })
  const igApprove = trpc.admin.approveIgVerification.useMutation({
    onSuccess: () => {
      toast.success('已通過')
      utils.admin.listIgVerifications.invalidate()
      utils.admin.listIgVerificationHistory.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })
  const igReject = trpc.admin.rejectIgVerification.useMutation({
    onSuccess: () => {
      toast.success('已退回')
      utils.admin.listIgVerifications.invalidate()
      utils.admin.listIgVerificationHistory.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  // Threads
  const [thFrom, setThFrom] = useState('')
  const [thTo, setThTo] = useState('')
  const { data: thPending, isLoading: thPendingLoading } = trpc.admin.listThreadsVerifications.useQuery()
  const { data: thHistory, isLoading: thHistoryLoading } = trpc.admin.listThreadsVerificationHistory.useQuery({
    from: thFrom || undefined,
    to: thTo || undefined,
  })
  const thApprove = trpc.admin.approveThreadsVerification.useMutation({
    onSuccess: () => {
      toast.success('已通過')
      utils.admin.listThreadsVerifications.invalidate()
      utils.admin.listThreadsVerificationHistory.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })
  const thReject = trpc.admin.rejectThreadsVerification.useMutation({
    onSuccess: () => {
      toast.success('已退回')
      utils.admin.listThreadsVerifications.invalidate()
      utils.admin.listThreadsVerificationHistory.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">社群驗證</h1>

      <Tabs defaultValue="instagram">
        <FilterTabsList items={[
          { value: 'instagram', label: 'Instagram', count: igPending?.length },
          { value: 'threads', label: 'Threads', count: thPending?.length },
        ]} />

        <div className="mt-6">
          <TabsContent value="instagram">
            <VerificationPanel
              platformLabel="Instagram"
              accountUrlPrefix="https://www.instagram.com/"
              showSource
              pending={igPending?.map(r => ({ id: r.id, seller_name: r.seller_name, code: r.code, created_at: r.created_at, account: r.ig_username }))}
              pendingLoading={igPendingLoading}
              history={igHistory?.map(r => ({ id: r.id, seller_name: r.seller_name, account: r.ig_username, status: r.status, source: r.source, reject_reason: r.reject_reason, reviewed_at: r.reviewed_at }))}
              historyLoading={igHistoryLoading}
              from={igFrom}
              to={igTo}
              onRangeChange={({ startDate, endDate }) => { setIgFrom(startDate); setIgTo(endDate) }}
              clearRange={() => { setIgFrom(''); setIgTo('') }}
              onApprove={(id) => igApprove.mutate({ id })}
              approvePending={igApprove.isPending}
              onReject={(id, reason) => igReject.mutate({ id, reason })}
              rejectPending={igReject.isPending}
            />
          </TabsContent>

          <TabsContent value="threads">
            <VerificationPanel
              platformLabel="Threads"
              accountUrlPrefix="https://www.threads.net/@"
              showSource={false}
              pending={thPending?.map(r => ({ id: r.id, seller_name: r.seller_name, code: r.code, created_at: r.created_at, account: r.threads_username }))}
              pendingLoading={thPendingLoading}
              history={thHistory?.map(r => ({ id: r.id, seller_name: r.seller_name, account: r.threads_username, status: r.status, reject_reason: r.reject_reason, reviewed_at: r.reviewed_at }))}
              historyLoading={thHistoryLoading}
              from={thFrom}
              to={thTo}
              onRangeChange={({ startDate, endDate }) => { setThFrom(startDate); setThTo(endDate) }}
              clearRange={() => { setThFrom(''); setThTo('') }}
              onApprove={(id) => thApprove.mutate({ id })}
              approvePending={thApprove.isPending}
              onReject={(id, reason) => thReject.mutate({ id, reason })}
              rejectPending={thReject.isPending}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
