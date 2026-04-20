'use client'

import { useState, useRef, useCallback, useEffect, type ChangeEvent, type DragEvent } from 'react'
import { ImageIcon, Loader2, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ImageLightbox } from '@/components/shared/image-lightbox'
import { toast } from 'sonner'

interface ImageUploadProps {
  purpose: 'product' | 'listing' | 'connection' | 'avatar'
  maxImages?: number
  images: { url: string; r2Key: string }[]
  onChange: (images: { url: string; r2Key: string }[]) => void
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
  const [isDragging, setIsDragging] = useState(false)
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([])
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!pendingFiles || pendingFiles.length === 0) {
      setPendingPreviews([])
      return
    }

    const urls = pendingFiles.map((file) => URL.createObjectURL(file))
    setPendingPreviews(urls)

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [pendingFiles])

  const totalCount = images.length + (pendingFiles?.length ?? 0)
  const remainingSlots = Math.max(maxImages - totalCount, 0)
  const previewItems = [
    ...images.map((image) => ({ url: image.url, removeKind: 'image' as const })),
    ...pendingPreviews.map((url) => ({ url, removeKind: 'pending' as const })),
  ]
  const lightboxImages = previewItems.map((item) => ({ url: item.url, alt: '' }))

  useEffect(() => {
    if (previewItems.length === 0) {
      setViewerIndex(0)
      setViewerOpen(false)
      return
    }

    setViewerIndex((current) => Math.min(current, previewItems.length - 1))
  }, [previewItems.length])

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (uploading || remainingSlots === 0) return

      const incoming = Array.from(files).filter((file) => file.type.startsWith('image/'))
      if (incoming.length === 0) return

      const accepted = incoming.slice(0, remainingSlots)
      if (accepted.length < incoming.length) {
        toast.error(`最多只能加入 ${remainingSlots} 張圖片`)
      }

      if (isDeferred) {
        onPendingFilesChange!([...(pendingFiles ?? []), ...accepted])
        return
      }

      setUploading(true)
      try {
        const uploaded = await uploadImageFiles(purpose, accepted)
        onChange([...images, ...uploaded])
      } catch (error) {
        console.error('Upload failed:', error)
        toast.error(error instanceof Error ? error.message : '圖片上傳失敗')
      } finally {
        setUploading(false)
      }
    },
    [images, isDeferred, onChange, onPendingFilesChange, pendingFiles, purpose, remainingSlots, uploading]
  )

  const openPicker = () => {
    if (remainingSlots === 0 || uploading) return
    inputRef.current?.click()
  }

  const openViewer = (index: number) => {
    setViewerIndex(index)
    setViewerOpen(true)
  }

  const removeImage = (index: number) => {
    onChange(images.filter((_, current) => current !== index))
  }

  const removePendingFile = (index: number) => {
    onPendingFilesChange?.(pendingFiles?.filter((_, current) => current !== index) ?? [])
  }

  const handleInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return
    await handleFiles(event.target.files)
    event.target.value = ''
  }

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
    await handleFiles(event.dataTransfer.files)
  }

  return (
    <div className={cn('space-y-3', className)}>
      <Card className="overflow-hidden bg-transparent shadow-none ring-0 py-0 gap-0">
        <CardContent className="p-0">
          <div
            role="button"
            tabIndex={remainingSlots > 0 && !uploading ? 0 : -1}
            aria-disabled={remainingSlots === 0 || uploading}
            onClick={remainingSlots > 0 && !uploading ? openPicker : undefined}
            onKeyDown={(event) => {
              if ((event.key === 'Enter' || event.key === ' ') && remainingSlots > 0 && !uploading) {
                event.preventDefault()
                openPicker()
              }
            }}
            onDragOver={(event) => {
              event.preventDefault()
              if (remainingSlots > 0 && !uploading) {
                setIsDragging(true)
              }
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              'flex min-h-56 items-center justify-center rounded-2xl border-2 border-dashed border-border/70 px-4 py-10 text-center transition-colors',
              isDragging && 'border-primary bg-primary/5',
              remainingSlots > 0 && !uploading ? 'cursor-pointer hover:bg-muted/30' : 'cursor-not-allowed opacity-70'
            )}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-border/60">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
              </div>
              <div className="space-y-1">
                <p className="text-base font-medium text-foreground">拖曳圖片到這裡</p>
                <p className="text-sm text-muted-foreground">或點擊選擇檔案</p>
                <p className="text-xs text-muted-foreground">JPEG, JPG, PNG, WEBP</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {previewItems.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, index) => (
            <Card key={`img-${img.r2Key}-${index}`} className="relative aspect-square overflow-hidden rounded-xl border-border/70 shadow-sm py-0 gap-0">
              <CardContent className="relative h-full w-full p-0">
                <button
                  type="button"
                  onClick={() => openViewer(index)}
                  className="block h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <img src={img.url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" draggable={false} />
                </button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  onClick={() => removeImage(index)}
                  className="absolute right-2 top-2 rounded-full bg-background/90 text-foreground shadow-sm hover:bg-background"
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">移除圖片</span>
                </Button>
              </CardContent>
            </Card>
          ))}

          {pendingPreviews.map((preview, index) => {
            const previewIndex = images.length + index
            return (
              <Card key={`pending-${index}`} className="relative aspect-square overflow-hidden rounded-xl border-dashed border-primary/40 bg-primary/5 shadow-sm ring-0 py-0 gap-0">
                <CardContent className="relative h-full w-full p-0">
                  <button
                    type="button"
                    onClick={() => openViewer(previewIndex)}
                    className="block h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <img src={preview} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" draggable={false} />
                  </button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    onClick={() => removePendingFile(index)}
                    className="absolute right-2 top-2 rounded-full bg-background/90 text-foreground shadow-sm hover:bg-background"
                  >
                    <X className="h-3 w-3" />
                    <span className="sr-only">移除待上傳圖片</span>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <ImageLightbox
        open={viewerOpen}
        images={lightboxImages}
        activeIndex={viewerIndex}
        onActiveIndexChange={setViewerIndex}
        onOpenChange={setViewerOpen}
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={maxImages > 1}
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  )
}
