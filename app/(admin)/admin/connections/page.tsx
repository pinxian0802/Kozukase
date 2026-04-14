'use client'

import { useState } from 'react'
import { Check, X, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/empty-state'
import { trpc } from '@/lib/trpc/client'
import { formatDate } from '@/lib/utils/format'
import { toast } from 'sonner'

export default function AdminConnectionsPage() {
  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.admin.pendingConnections.useQuery({ limit: 50 })
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [removeReason, setRemoveReason] = useState('')

  const approve = trpc.admin.approveConnection.useMutation({
    onSuccess: () => { toast.success('已通過'); utils.admin.pendingConnections.invalidate() },
    onError: (err) => toast.error(err.message),
  })

  const remove = trpc.admin.removeConnection.useMutation({
    onSuccess: () => {
      toast.success('已結束')
      setRemoveId(null)
      setRemoveReason('')
      utils.admin.pendingConnections.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">連線審核</h1>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      ) : data?.items && data.items.length > 0 ? (
        <div className="space-y-3">
          {data.items.map((conn: any) => (
            <div key={conn.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">
                    {conn.region?.name}{conn.sub_region ? ` - ${conn.sub_region}` : ''}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    賣家：{conn.seller?.name ?? '未知'} · {formatDate(conn.start_date)} ~ {formatDate(conn.end_date)}
                  </p>
                  {conn.description && <p className="text-sm mt-1">{conn.description}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => approve.mutate({ id: conn.id })} disabled={approve.isPending}>
                    <Check className="mr-1 h-3 w-3" />通過
                  </Button>
                  <Dialog open={removeId === conn.id} onOpenChange={(open) => { if (!open) setRemoveId(null) }}>
                    <DialogTrigger nativeButton render={<Button size="sm" variant="destructive" onClick={() => setRemoveId(conn.id)} />}>
                        <X className="mr-1 h-3 w-3" />駁回
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>駁回連線</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div>
                          <Label>駁回原因</Label>
                          <Textarea value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} placeholder="請填寫原因..." className="mt-1" />
                        </div>
                        <Button variant="destructive" className="w-full" onClick={() => remove.mutate({ id: conn.id, admin_note: removeReason })} disabled={remove.isPending || !removeReason.trim()}>
                          確認駁回
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Globe} title="沒有待審核的連線" description="目前沒有需要審核的連線申請" />
      )}
    </div>
  )
}
