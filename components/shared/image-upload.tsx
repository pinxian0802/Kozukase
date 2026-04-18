'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'

interface ImageUploadProps {
  purpose: 'product' | 'listing' | 'connection' | 'avatar'
  maxImages?: number
  images: { url: string; r2Key: string }[]
  onChange: (images: { url: string; r2Key: string }[]) => void
  /** Deferred mode: pending File objects not yet uploaded. Show local previews only. */
  pendingFiles?: File[]
  onPendingFilesChange?: (files: File[]) => void
  className?: string
}

/** Compress and upload files to R2 via /api/upload. Returns uploaded image info. */
export async function uploadImageFiles(
  purpose: 'product' | 'listing' | 'connection' | 'avatar',
  files: File[]
): Promise<{ url: string; r2Key: string }[]> {
  const { default: imageCompression } = await import('browser-image-compression')
  const results: { url: string; r2Key: string }[] = []
  for (const file of files) {
    const compressed = await imageCompression(file, {
      maxSizeMB: 5,
      maxWidthOrHeight: 1920,
      fileType: 'image/webp',
    })
    const uploadFile = new File(
      [compressed],
      file.name.replace(/\.[^.]+$/, '.webp'),
      { type: compressed.type || 'image/webp' }
    )
    const formData = new FormData()
    formData.append('purpose', purpose)
    formData.append('file', uploadFile)
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new Error(payload?.error ?? payload?.message ?? '圖片上傳失敗')
    }
    const { r2Key, publicUrl } = await response.json()
    results.push({ url: publicUrl, r2Key })
  }
  return results
}

export function ImageUpload({
  purpose,
  maxImages = 1,
  images,
  onChange,
  pendingFiles,
  onPendingFilesChange,
  className,
}: ImageUploadProps) {
  const isDeferred = pendingFiles !== undefined && onPendingFilesChange !== undefined
  const [uploading, setUploading] = useState(false)
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Create/revoke object URLs for pending file previews
  useEffect(() => {
    if (!pendingFiles || pendingFiles.length === 0) {
      setPendingPreviews([])
      return
    }
    const urls = pendingFiles.map((f) => URL.createObjectURL(f))
    setPendingPreviews(urls)
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [pendingFiles])

  const totalCount = images.length + (pendingFiles?.length ?? 0)

  const handleFiles = useCallback(
    async (files: FileList) => {
      if (totalCount + files.length > maxImages) return

      if (isDeferred) {
        // Deferred mode: just store the File objects, no upload
        onPendingFilesChange!([...(pendingFiles ?? []), ...Array.from(files)])
        return
      }

      // Immediate upload mode
      setUploading(true)
      try {
        const uploaded = await uploadImageFiles(purpose, Array.from(files))
        onChange([...images, ...uploaded])
      } catch (error) {
        console.error('Upload failed:', error)
        toast.error(error instanceof Error ? error.message : '圖片上傳失敗')
      } finally {
        setUploading(false)
      }
    },
    [images, pendingFiles, maxImages, purpose, onChange, onPendingFilesChange, isDeferred, totalCount]
  )

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index))
  }

  const removePendingFile = (index: number) => {
    onPendingFilesChange!(pendingFiles!.filter((_, i) => i !== index))
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap gap-3">
        {images.map((img, i) => (
          <Card key={`img-${i}`} className="group relative h-24 w-24 overflow-hidden rounded-2xl border-border/70 shadow-sm">
            <CardContent className="relative h-full w-full p-0">
              <img src={img.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                onClick={() => removeImage(i)}
                className="absolute right-2 top-2 rounded-full bg-background/90 text-foreground shadow-sm hover:bg-background"
              >
                <X className="h-3 w-3" />
                <span className="sr-only">移除圖片</span>
              </Button>
            </CardContent>
          </Card>
        ))}
        {pendingPreviews.map((preview, i) => (
          <Card
            key={`pending-${i}`}
            className="group relative h-24 w-24 overflow-hidden rounded-2xl border border-dashed border-primary/50 shadow-sm"
          >
            <CardContent className="relative h-full w-full p-0">
              <img src={preview} alt="" loading="lazy" className="h-full w-full object-cover opacity-80" />
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                onClick={() => removePendingFile(i)}
                className="absolute right-2 top-2 rounded-full bg-background/90 text-foreground shadow-sm hover:bg-background"
              >
                <X className="h-3 w-3" />
                <span className="sr-only">移除待上傳圖片</span>
              </Button>
            </CardContent>
          </Card>
        ))}
        {totalCount < maxImages && (
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            variant="outline"
            className="flex h-24 w-24 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/70 text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <Upload className="h-6 w-6" />
                <span className="mt-1 text-xs">上傳</span>
              </>
            )}
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={maxImages > 1}
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  )
}
