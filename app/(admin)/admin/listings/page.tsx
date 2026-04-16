'use client'

import { useState } from 'react'
import { Check, X, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/empty-state'
import { trpc } from '@/lib/trpc/client'
import { formatDate } from '@/lib/utils/format'
import { toast } from 'sonner'

export default function AdminListingsPage() {
  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.admin.pendingListings.useQuery({ limit: 50 })
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [removeReason, setRemoveReason] = useState('')

  const approve = trpc.admin.approveListing.useMutation({
    onSuccess: () => { toast.success('已通過'); utils.admin.pendingListings.invalidate() },
    onError: (err) => toast.error(err.message),
  })

  const remove = trpc.admin.removeListing.useMutation({
    onSuccess: () => {
      toast.success('已下架')
      setRemoveId(null)
      setRemoveReason('')
      utils.admin.pendingListings.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  const getListingImageUrl = (listing: any) => listing.product?.catalog_image?.url ?? listing.product?.product_images?.[0]?.url ?? null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">代購審核</h1>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      ) : data?.items && data.items.length > 0 ? (
        <div className="space-y-3">
          {data.items.map((listing: any) => (
            <div key={listing.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {getListingImageUrl(listing) ? (
                      <img
                        src={getListingImageUrl(listing)}
                        alt={listing.product?.name ?? ''}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Package className="h-5 w-5 opacity-50" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                  <p className="font-medium">{listing.product?.name ?? '未知商品'}</p>
                  <p className="text-sm text-muted-foreground">
                    賣家：{listing.seller?.name ?? '未知'} · {formatDate(listing.created_at)}
                  </p>
                  {listing.note && <p className="text-sm mt-1">{listing.note}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => approve.mutate({ id: listing.id })} disabled={approve.isPending}>
                    <Check className="mr-1 h-3 w-3" />通過
                  </Button>
                  <Dialog open={removeId === listing.id} onOpenChange={(open) => { if (!open) setRemoveId(null) }}>
                    <DialogTrigger nativeButton render={<Button size="sm" variant="destructive" onClick={() => setRemoveId(listing.id)} />}>
                        <X className="mr-1 h-3 w-3" />駁回
                    </DialogTrigger>
                      <DialogContent>
                      <DialogHeader><DialogTitle>駁回代購</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div>
                          <Label>駁回原因</Label>
                          <Textarea value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} placeholder="請填寫原因..." className="mt-1" />
                        </div>
                        <Button variant="destructive" className="w-full" onClick={() => remove.mutate({ id: listing.id, admin_note: removeReason })} disabled={remove.isPending || !removeReason.trim()}>
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
        <EmptyState icon={Package} title="沒有待審核的商品" description="目前沒有需要審核的上架申請" />
      )}
    </div>
  )
}
