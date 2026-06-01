'use client'

import { useState, useRef, useEffect, type ChangeEvent } from 'react'
import { Camera, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
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
  // Track blob URL for cleanup
  const blobUrlRef = useRef<string | null>(null)
  // Track previous pendingFile to detect File → null transition
  const prevPendingFileRef = useRef(pendingFile)
  const inputRef = useRef<HTMLInputElement>(null)

  const clearBlobUrl = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
  }

  // Fix Flash 2: when pendingFile goes File → null (after save), preload value.url
  // before clearing pendingPreview so there's no blank frame during the transition
  useEffect(() => {
    const prev = prevPendingFileRef.current
    prevPendingFileRef.current = pendingFile

    if (prev != null && !pendingFile) {
      if (value?.url) {
        const img = new Image()
        const clear = () => {
          clearBlobUrl()
          setPendingPreview(null)
        }
        img.onload = clear
        img.onerror = clear
        img.src = value.url
        return () => {
          img.onload = null
          img.onerror = null
        }
      } else {
        clearBlobUrl()
        setPendingPreview(null)
      }
    }
  // value?.url intentionally omitted: we only care about the pendingFile transition
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFile])

  // Cleanup blob URL on unmount
  useEffect(() => () => { clearBlobUrl() }, [])

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
        // Fix Flash 1: create blob URL synchronously so preview and pendingFile
        // update in the same render batch — no intermediate blank frame
        clearBlobUrl()
        const previewUrl = URL.createObjectURL(file)
        blobUrlRef.current = previewUrl
        setPendingPreview(previewUrl)
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

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    clearBlobUrl()
    setPendingPreview(null)
    if (isDeferred) {
      onPendingFileChange!(null)
    }
    onChange(null)
  }

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {/* Avatar circle — the single interactive focal point */}
      <div className="group relative flex-shrink-0">
        {hasImage ? (
          <>
            {/* Avatar with hover-reveal overlay */}
            <button
              type="button"
              onClick={() => !uploading && inputRef.current?.click()}
              disabled={uploading}
              className={cn(
                'relative h-24 w-24 rounded-full overflow-hidden transition-all duration-200',
                uploading ? 'cursor-not-allowed' : 'cursor-pointer',
              )}
              aria-label="更換頭貼"
            >
              <Avatar className="h-full w-full">
                <AvatarImage src={displayUrl} className="object-cover" />
                <AvatarFallback className="text-2xl bg-muted">?</AvatarFallback>
              </Avatar>

              {/* Hover / loading overlay */}
              <span
                className={cn(
                  'absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-black/50 backdrop-blur-[1px] transition-opacity duration-200',
                  uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                )}
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <>
                    <Camera className="h-5 w-5 text-white" strokeWidth={1.5} />
                    <span className="text-[10px] font-medium tracking-wide text-white/90">
                      更換
                    </span>
                  </>
                )}
              </span>
            </button>

            {/* Floating remove badge */}
            {!uploading && (
              <button
                type="button"
                onClick={handleRemove}
                aria-label="刪除頭貼"
                className="absolute -right-4 -top-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-foreground/80 text-background shadow-md backdrop-blur-sm transition-all duration-150 hover:bg-foreground hover:scale-110"
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
            )}
          </>
        ) : (
          /* Empty state — dashed ring with camera prompt */
          <button
            type="button"
            onClick={() => !uploading && inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              'relative flex h-24 w-24 flex-col items-center justify-center gap-1.5 rounded-full border-2 border-dashed transition-all duration-200',
              uploading
                ? 'cursor-not-allowed border-border opacity-50'
                : 'cursor-pointer border-border text-muted-foreground hover:border-foreground/40 hover:bg-muted/40 hover:text-foreground',
            )}
            aria-label="上傳頭貼"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Camera className="h-5 w-5" strokeWidth={1.5} />
                <span className="text-[10px] font-medium tracking-wide">上傳</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Format hint — only shown when no image, sits beside the circle */}
      {!hasImage && (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-foreground/70">新增頭貼</span>
          <span className="text-[11px] text-muted-foreground">建議 300×300 px 以上，正方形</span>
          <span className="text-[11px] text-muted-foreground">JPG、PNG、HEIC，最大 10 MB</span>
        </div>
      )}

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
