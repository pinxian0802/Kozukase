'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ImageUpload, uploadImageFiles } from '@/components/shared/image-upload'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'

interface ConnectionFormProps {
  mode: 'create' | 'edit'
  initialData?: any
}

export function ConnectionForm({ mode, initialData }: ConnectionFormProps) {
  const router = useRouter()

  const [regionId, setRegionId] = useState(initialData?.region_id ?? '')
  const [subRegion, setSubRegion] = useState(initialData?.sub_region ?? '')
  const [startDate, setStartDate] = useState(initialData?.start_date?.split('T')[0] ?? '')
  const [endDate, setEndDate] = useState(initialData?.end_date?.split('T')[0] ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [images, setImages] = useState<{ url: string; r2Key: string }[]>(
    (initialData?.images ?? initialData?.connection_images ?? []).map((img: any) => ({
      url: img.url ?? img.image_url,
      r2Key: img.r2_key ?? img.r2Key,
    })) ?? []
  )
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  const { data: regionsData } = trpc.seller.getRegions.useQuery()
  const selectedRegionName = regionsData?.find((region: any) => region.id === regionId)?.name

  const createConnection = trpc.connection.create.useMutation()
  const updateConnection = trpc.connection.update.useMutation()
  const deleteConnection = trpc.connection.delete.useMutation()
  const confirmImages = trpc.upload.confirmConnectionImages.useMutation()
  const deleteObjects = trpc.upload.deleteObjects.useMutation()

  const handleSubmit = async () => {
    if (!regionId || !startDate || !endDate) {
      toast.error('\u8acb\u586b\u5beb\u6240\u6709\u5fc5\u586b\u6b04\u4f4d')
      return
    }

    const toastId = toast.loading('\u8655\u7406\u4e2d...')

    // Track created resources for compensating rollback
    let createdConnectionId: string | null = null
    const uploadedR2Keys: string[] = []

    try {
      if (mode === 'create') {
        // ── Step 1: Create connection record first ──
        const result = await createConnection.mutateAsync({
          region_id: regionId,
          sub_region: subRegion || undefined,
          start_date: startDate,
          end_date: endDate,
          description: description || undefined,
        })
        createdConnectionId = result.id

        // ── Step 2: Upload images to R2, collect keys for rollback ──
        if (pendingFiles.length > 0) {
          const uploadedImages = await uploadImageFiles('connection', pendingFiles)
          uploadedR2Keys.push(...uploadedImages.map(img => img.r2Key))
          const allImages = [...images, ...uploadedImages]
          // ── Step 3: Confirm image relations in DB (atomic via RPC) ──
          await confirmImages.mutateAsync({
            connection_id: result.id,
            images: allImages.map((img, i) => ({ r2_key: img.r2Key, url: img.url, sort_order: i })),
          })
        }

        toast.dismiss(toastId)
        toast.success('\u5df2\u5efa\u7acb\u9023\u7dda\u516c\u544a')
      } else {
        // ── Edit flow: upload first, then update data, then confirm ──
        const uploadedImages = pendingFiles.length > 0
          ? await uploadImageFiles('connection', pendingFiles)
          : []
        const allImages = [...images, ...uploadedImages]
        await updateConnection.mutateAsync({
          id: initialData.id,
          region_id: regionId || undefined,
          sub_region: subRegion || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          description: description || undefined,
        })
        await confirmImages.mutateAsync({
          connection_id: initialData.id,
          images: allImages.map((img, i) => ({ r2_key: img.r2Key, url: img.url, sort_order: i })),
        })
        toast.dismiss(toastId)
        toast.success('\u5df2\u66f4\u65b0\u9023\u7dda\u516c\u544a')
      }

      router.push('/dashboard/connections')
    } catch (err: any) {
      // ── Compensating rollback (create mode only) ─────────────────────────
      if (mode === 'create') {
        if (uploadedR2Keys.length > 0) {
          await deleteObjects.mutateAsync({ r2Keys: uploadedR2Keys }).catch(() => {})
        }
        if (createdConnectionId) {
          await deleteConnection.mutateAsync({ id: createdConnectionId }).catch(() => {})
        }
      }
      toast.dismiss(toastId)
      toast.error(err.message ?? '\u64cd\u4f5c\u5931\u6557')
    }
  }

  const isPending = createConnection.isPending || updateConnection.isPending || confirmImages.isPending

  return (
    <div className="space-y-6">
      <div>
        <Label>連線國家 *</Label>
        <Select value={regionId} onValueChange={setRegionId}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="選擇國家">{selectedRegionName}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(regionsData ?? []).map((r: any) => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="subRegion">地區（選填）</Label>
        <Input
          id="subRegion"
          value={subRegion}
          onChange={(e) => setSubRegion(e.target.value)}
          placeholder="例：東京、大阪"
          maxLength={100}
          className="mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">開始日期 *</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="endDate">結束日期 *</Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">說明（選填）</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="補充連線行程說明..."
          maxLength={500}
          className="mt-1"
        />
      </div>

      <div>
        <Label>圖片（最多 5 張）</Label>
        <ImageUpload
          purpose="connection"
          maxImages={5}
          images={images}
          onChange={setImages}
          pendingFiles={pendingFiles}
          onPendingFilesChange={setPendingFiles}
          className="mt-2"
        />
      </div>

      <Button onClick={handleSubmit} disabled={isPending} className="w-full">
        {isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
        {mode === 'create' ? '建立連線公告' : '更新連線公告'}
      </Button>
    </div>
  )
}
