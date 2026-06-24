'use client'

import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

const PURPOSE_LABEL: Record<string, string> = {
  product: '商品',
  listing: '代購',
  connection: '連線',
  avatar: '大頭貼',
  message: '訊息',
  banner: '橫幅',
  unknown: '未知',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function AdminStoragePage() {
  const [hasScanned, setHasScanned] = useState(false)

  const scan = trpc.storage.scanOrphanImages.useQuery(
    { minAgeHours: 24 },
    { enabled: false },
  )

  const deleteMut = trpc.storage.deleteOrphanImages.useMutation({
    onSuccess: (res) => {
      toast.success(`已刪除 ${res.deleted} 張孤兒圖片`)
      scan.refetch()
    },
    onError: (e) => toast.error(e.message),
  })

  const orphans = scan.data?.orphans ?? []

  const handleScan = async () => {
    await scan.refetch()
    setHasScanned(true)
  }

  const handleDelete = () => {
    if (orphans.length === 0) return
    if (!confirm(`確定刪除這 ${orphans.length} 張孤兒圖片?此動作無法復原。`)) return
    deleteMut.mutate({ keys: orphans.map((o) => o.key) })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[17px] font-bold font-heading md:text-2xl">儲存空間清理</h1>
        <p className="mt-1 text-muted-foreground">
          掃描 R2 上沒有任何資料庫資料指向、且上傳超過 24 小時的孤兒圖片。先掃描檢視清單,確認後再刪除。
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleScan} disabled={scan.isFetching}>
          {scan.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : '掃描孤兒圖片'}
        </Button>
        {hasScanned && !scan.isFetching && (
          <span className="text-sm text-muted-foreground">
            共 {scan.data?.totalCount ?? 0} 張,可釋放 {formatBytes(scan.data?.totalBytes ?? 0)}
          </span>
        )}
      </div>

      {hasScanned && orphans.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {orphans.map((o) => (
              <div key={o.key} className="rounded-lg border bg-card p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={o.url}
                  alt=""
                  loading="lazy"
                  className="aspect-square w-full rounded object-cover"
                />
                <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  <div className="font-medium text-foreground">{PURPOSE_LABEL[o.purpose] ?? o.purpose}</div>
                  <div>{formatBytes(o.size)}</div>
                  <div>{new Date(o.lastModified).toLocaleString('zh-TW')}</div>
                </div>
              </div>
            ))}
          </div>

          <Button variant="destructive" onClick={handleDelete} disabled={deleteMut.isPending}>
            {deleteMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <><Trash2 className="mr-2 h-4 w-4" />刪除全部 {orphans.length} 張</>
            )}
          </Button>
        </>
      )}

      {hasScanned && !scan.isFetching && orphans.length === 0 && (
        <p className="text-muted-foreground">沒有發現孤兒圖片,儲存空間是乾淨的。</p>
      )}
    </div>
  )
}
