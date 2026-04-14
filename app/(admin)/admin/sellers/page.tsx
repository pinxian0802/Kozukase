'use client'

import { useState } from 'react'
import { Search, Users, Ban, CheckCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/empty-state'
import { trpc } from '@/lib/trpc/client'
import { formatDate } from '@/lib/utils/format'
import { toast } from 'sonner'

export default function AdminSellersPage() {
  const [search, setSearch] = useState('')
  const [suspendId, setSuspendId] = useState<string | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const utils = trpc.useUtils()

  const { data, isLoading } = trpc.admin.listSellers.useQuery({ search: search || undefined, limit: 50 })

  const suspend = trpc.admin.suspendSeller.useMutation({
    onSuccess: () => {
      toast.success('已停權')
      setSuspendId(null)
      setSuspendReason('')
      utils.admin.listSellers.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  const unsuspend = trpc.admin.unsuspendSeller.useMutation({
    onSuccess: () => { toast.success('已解除停權'); utils.admin.listSellers.invalidate() },
    onError: (err) => toast.error(err.message),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">賣家管理</h1>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋賣家..."
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : data?.items && data.items.length > 0 ? (
        <div className="space-y-2">
          {data.items.map((seller: any) => (
            <div key={seller.id} className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{seller.name}</p>
                  {seller.is_suspended && <Badge variant="destructive">已停權</Badge>}
                  {seller.is_social_verified && <Badge variant="secondary">社群認證</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  加入於 {formatDate(seller.created_at)} · 評價 {seller.avg_rating?.toFixed(1) ?? 'N/A'} ({seller.review_count ?? 0})
                </p>
              </div>
              <div className="flex gap-2">
                {seller.is_suspended ? (
                  <Button size="sm" onClick={() => unsuspend.mutate({ seller_id: seller.id })} disabled={unsuspend.isPending}>
                    <CheckCircle className="mr-1 h-3 w-3" />解除停權
                  </Button>
                ) : (
                  <Dialog open={suspendId === seller.id} onOpenChange={(open) => { if (!open) setSuspendId(null) }}>
                    <DialogTrigger nativeButton render={<Button size="sm" variant="destructive" onClick={() => setSuspendId(seller.id)} />}>
                        <Ban className="mr-1 h-3 w-3" />停權
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>停權賣家</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <p className="text-sm">確定要停權「{seller.name}」？此操作會下架所有 Listing 和結束所有連線。</p>
                        <div>
                          <Label>停權原因</Label>
                          <Textarea value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder="請填寫原因..." className="mt-1" />
                        </div>
                        <Button variant="destructive" className="w-full" onClick={() => suspend.mutate({ seller_id: seller.id, reason: suspendReason })} disabled={suspend.isPending || !suspendReason.trim()}>
                          確認停權
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Users} title="沒有找到賣家" />
      )}
    </div>
  )
}
