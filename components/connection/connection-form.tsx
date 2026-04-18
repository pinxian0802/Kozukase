'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Field } from '@base-ui/react/field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
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

  const createConnection = trpc.connection.create.useMutation()
  const updateConnection = trpc.connection.update.useMutation()
  const deleteConnection = trpc.connection.delete.useMutation()
  const confirmImages = trpc.upload.confirmConnectionImages.useMutation()
  const deleteObjects = trpc.upload.deleteObjects.useMutation()

  const handleSubmit = async () => {
    if (!regionId || !startDate || !endDate) {
      toast.error('請填寫所有必填欄位')
      return
    }

    const toastId = toast.loading('處理中...')

    let createdConnectionId: string | null = null
    const uploadedR2Keys: string[] = []

    try {
      if (mode === 'create') {
        const result = await createConnection.mutateAsync({
          region_id: regionId,
          sub_region: subRegion || undefined,
          start_date: startDate,
          end_date: endDate,
          description: description || undefined,
        })
        createdConnectionId = result.id

        if (pendingFiles.length > 0) {
          const uploadedImages = await uploadImageFiles('connection', pendingFiles)
          uploadedR2Keys.push(...uploadedImages.map((img) => img.r2Key))
          const allImages = [...images, ...uploadedImages]
          await confirmImages.mutateAsync({
            connection_id: result.id,
            images: allImages.map((img, index) => ({ r2_key: img.r2Key, url: img.url, sort_order: index })),
          })
        }

        toast.dismiss(toastId)
        toast.success('已建立連線公告')
      } else {
        const uploadedImages = pendingFiles.length > 0 ? await uploadImageFiles('connection', pendingFiles) : []
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
          images: allImages.map((img, index) => ({ r2_key: img.r2Key, url: img.url, sort_order: index })),
        })

        toast.dismiss(toastId)
        toast.success('已更新連線公告')
      }

      router.push('/dashboard/connections')
    } catch (error: any) {
      if (mode === 'create') {
        if (uploadedR2Keys.length > 0) {
          await deleteObjects.mutateAsync({ r2Keys: uploadedR2Keys }).catch(() => {})
        }
        if (createdConnectionId) {
          await deleteConnection.mutateAsync({ id: createdConnectionId }).catch(() => {})
        }
      }

      toast.dismiss(toastId)
      toast.error(error.message ?? '操作失敗')
    }
  }

  const isPending = createConnection.isPending || updateConnection.isPending || confirmImages.isPending

  return (
    <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); handleSubmit() }}>
      <Field.Root className="space-y-2" name="region_id" validate={() => (regionId ? null : '請選擇國家')}>
        <Label className="text-sm font-medium text-foreground">連線國家 *</Label>
        <Select value={regionId} onValueChange={setRegionId} name="region_id" required>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="選擇國家" />
          </SelectTrigger>
          <SelectContent>
            {(regionsData ?? []).map((region: any) => (
              <SelectItem key={region.id} value={region.id}>
                {region.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field.Root>

      <div className="space-y-2">
        <Label htmlFor="subRegion" className="text-sm font-medium text-foreground">地區（選填）</Label>
        <Input
          id="subRegion"
          value={subRegion}
          onChange={(e) => setSubRegion(e.target.value)}
          placeholder="例：東京、大阪"
          maxLength={100}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startDate" className="text-sm font-medium text-foreground">開始日期 *</Label>
          <DatePicker value={startDate} onValueChange={setStartDate} placeholder="選擇開始日期" className="w-full" name="start_date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate" className="text-sm font-medium text-foreground">結束日期 *</Label>
          <DatePicker value={endDate} onValueChange={setEndDate} placeholder="選擇結束日期" className="w-full" name="end_date" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-medium text-foreground">說明（選填）</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="補充連線行程說明..."
          maxLength={500}
          className="min-h-32 resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label>圖片（最多 5 張）</Label>
        <ImageUpload
          purpose="connection"
          maxImages={5}
          images={images}
          onChange={setImages}
          pendingFiles={pendingFiles}
          onPendingFilesChange={setPendingFiles}
          className="rounded-2xl border border-dashed border-border/70 bg-background/50 p-4"
        />
      </div>

      <Button type="submit" disabled={isPending} size="lg" className="w-full">
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {mode === 'create' ? '建立連線公告' : '更新連線公告'}
      </Button>
    </form>
  )
}
