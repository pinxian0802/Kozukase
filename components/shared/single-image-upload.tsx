'use client'

import { useState, useRef, useEffect, type ChangeEvent } from 'react'
import { ImageIcon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { uploadImageFiles } from '@/components/shared/image-upload'
import { normalizeImageFile } from '@/lib/utils/heic'

interface SingleImageUploadProps {
  purpose: 'product' | 'listing' | 'connection' | 'avatar'
  value: { url: string; r2Key: string } | null
  onChange: (value: { url: string; r2Key: string } | null) => void
  pendingFile?: File | null
  onPendingFileChange?: (file: File | null) => void
  className?: string
  invalid?: boolean
}

export function SingleImageUpload({
  purpose,
  value,
  onChange,
  pendingFile,
  onPendingFileChange,
  className,
  invalid,
}: SingleImageUploadProps) {
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

  const displayUrl = pendingPreview ?? value?.url ?? null

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

      const [uploaded] = await uploadImageFiles(purpose, [file], getPresignedUrl.mutateAsync)
      onChange(uploaded)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '圖片上傳失敗')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          'relative h-32 w-32 overflow-hidden rounded-xl border-2 transition-colors',
          displayUrl
            ? 'border-border cursor-pointer'
            : 'border-dashed border-border bg-muted/30 cursor-pointer hover:border-primary hover:bg-muted/50',
          invalid && !displayUrl && 'border-destructive',
          uploading && 'cursor-not-allowed opacity-60',
          className,
        )}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
            {uploading
              ? <Loader2 className="h-6 w-6 animate-spin" />
              : <ImageIcon className="h-6 w-6" />
            }
          </span>
        )}

        {uploading && displayUrl && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </span>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  )
}
