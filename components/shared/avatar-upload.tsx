'use client'

import { useState, useRef, useEffect, type ChangeEvent } from 'react'
import { Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { uploadImageFiles } from '@/components/shared/image-upload'
import { normalizeImageFile } from '@/lib/utils/heic'

interface AvatarUploadProps {
  value: { url: string; r2Key: string } | null
  onChange: (value: { url: string; r2Key: string } | null) => void
  pendingFile?: File | null
  onPendingFileChange?: (file: File | null) => void
  className?: string
}

export function AvatarUpload({
  value,
  onChange,
  pendingFile,
  onPendingFileChange,
  className,
}: AvatarUploadProps) {
  const isDeferred = pendingFile !== undefined && onPendingFileChange !== undefined
  const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation()
  const [uploading, setUploading] = useState(false)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!pendingFile) {
      setPendingPreview(null)
      return
    }
    const url = URL.createObjectURL(pendingFile)
    setPendingPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [pendingFile])

  const hasImage = pendingFile != null || value != null
  const displayUrl = pendingPreview ?? value?.url ?? undefined

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0]
    if (!raw) return
    e.target.value = ''

    setUploading(true)
    try {
      const file = await normalizeImageFile(raw)

      if (isDeferred) {
        onPendingFileChange!(file)
        return
      }

      const [uploaded] = await uploadImageFiles('avatar', [file], getPresignedUrl.mutateAsync)
      onChange(uploaded)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '圖片上傳失敗')
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = () => {
    if (isDeferred) {
      onPendingFileChange!(null)
    }
    onChange(null)
  }

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {hasImage ? (
        <div className="relative h-[72px] w-[72px] flex-shrink-0">
          <Avatar className="h-full w-full">
            <AvatarImage src={displayUrl} />
            <AvatarFallback className="text-2xl">?</AvatarFallback>
          </Avatar>
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </span>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => !uploading && inputRef.current?.click()}
          className={cn(
            'relative h-[72px] w-[72px] flex-shrink-0 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground text-xl transition-colors',
            uploading ? 'cursor-not-allowed opacity-60' : 'hover:border-primary hover:bg-muted/30',
          )}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : '+'}
        </button>
      )}

      <div className="flex flex-col gap-1.5">
        {hasImage ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              更換頭貼
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive justify-start px-0"
              onClick={handleRemove}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              刪除頭貼
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              上傳頭貼
            </Button>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
