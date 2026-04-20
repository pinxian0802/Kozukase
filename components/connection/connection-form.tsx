'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { addDays, isAfter, parseISO, startOfDay } from 'date-fns'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { ImageUpload, uploadImageFiles } from '@/components/shared/image-upload'
import { FormFieldError } from '@/components/shared/form-field-error'
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
  const [errors, setErrors] = useState<{ regionId?: string; startDate?: string; endDate?: string }>({})

  const { data: regionsData } = trpc.seller.getRegions.useQuery()
  const regionLabelById = new Map((regionsData ?? []).map((region: any) => [region.id, region.name]))

  const today = startOfDay(new Date())
  const parsedStartDate = startDate ? parseISO(startDate) : null
  const parsedEndDate = endDate ? parseISO(endDate) : null
  const endDateMin = parsedStartDate ? addDays(parsedStartDate, 1) : today

  const createConnection = trpc.connection.create.useMutation()
  const updateConnection = trpc.connection.update.useMutation()
  const deleteConnection = trpc.connection.delete.useMutation()
  const confirmImages = trpc.upload.confirmConnectionImages.useMutation()
  const deleteObjects = trpc.upload.deleteObjects.useMutation()
  const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation()

  const clearError = (field: keyof typeof errors) => {
    setErrors((current) => {
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handleSubmit = async () => {
    const nextErrors: { regionId?: string; startDate?: string; endDate?: string } = {}

    if (!regionId) {
      nextErrors.regionId = '連線國家為必填'
    }

    if (!startDate) {
      nextErrors.startDate = '開始日期為必填'
    }

    if (!endDate) {
      nextErrors.endDate = '結束日期為必填'
    }

    if (startDate && endDate && parsedStartDate && parsedEndDate && !isAfter(parsedEndDate, parsedStartDate)) {
      nextErrors.endDate = '結束日期必須晚於開始日期'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})

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
          const uploadedImages = await uploadImageFiles('connection', pendingFiles, getPresignedUrl.mutateAsync)
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
        const uploadedImages = pendingFiles.length > 0 ? await uploadImageFiles('connection', pendingFiles, getPresignedUrl.mutateAsync) : []
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
    <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); handleSubmit() }} noValidate>
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">連線國家 *</Label>
        <Select
          value={regionId}
          onValueChange={(value) => {
            setRegionId(value)
            if (errors.regionId) clearError('regionId')
          }}
          name="region_id"
        >
          <SelectTrigger className="w-full" aria-invalid={!!errors.regionId}>
            <SelectValue placeholder="選擇國家">
              {(value) => (value ? regionLabelById.get(value) ?? '選擇國家' : '選擇國家')}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(regionsData ?? []).map((region: any) => (
              <SelectItem key={region.id} value={region.id}>
                {region.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormFieldError message={errors.regionId} />
      </div>

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
          <DatePicker
            value={startDate}
            onValueChange={(value) => {
              setStartDate(value)
              if (errors.startDate) clearError('startDate')

              if (value && endDate) {
                const nextStartDate = parseISO(value)
                const currentEndDate = parseISO(endDate)

                if (isAfter(nextStartDate, currentEndDate) || nextStartDate.getTime() === currentEndDate.getTime()) {
                  setEndDate('')
                  setErrors((current) => ({
                    ...current,
                    endDate: '結束日期必須晚於開始日期',
                  }))
                }
              }
            }}
            placeholder="選擇開始日期"
            className="w-full"
            name="start_date"
            invalid={!!errors.startDate}
            minDate={today}
          />
          <FormFieldError message={errors.startDate} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate" className="text-sm font-medium text-foreground">結束日期 *</Label>
          <DatePicker
            value={endDate}
            onValueChange={(value) => {
              setEndDate(value)
              if (errors.endDate) clearError('endDate')

              if (value && startDate) {
                const nextEndDate = parseISO(value)
                const currentStartDate = parseISO(startDate)

                if (!isAfter(nextEndDate, currentStartDate)) {
                  setErrors((current) => ({
                    ...current,
                    endDate: '結束日期必須晚於開始日期',
                  }))
                }
              }
            }}
            placeholder="選擇結束日期"
            className="w-full"
            name="end_date"
            invalid={!!errors.endDate}
            minDate={endDateMin}
          />
          <FormFieldError message={errors.endDate} />
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
          className="mt-2"
        />
      </div>

      <button type="submit" disabled={isPending} className={buttonVariants({ size: 'lg', className: 'w-full' })}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {mode === 'create' ? '建立連線公告' : '更新連線公告'}
      </button>
    </form>
  )
}
