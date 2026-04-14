'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { trpc } from '@/lib/trpc/client'
import imageCompression from 'browser-image-compression'

interface ImageUploadProps {
  purpose: 'product' | 'listing' | 'connection' | 'avatar'
  maxImages?: number
  images: { url: string; r2Key: string }[]
  onChange: (images: { url: string; r2Key: string }[]) => void
  className?: string
}

export function ImageUpload({ purpose, maxImages = 1, images, onChange, className }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation()

  const handleUpload = useCallback(async (files: FileList) => {
    if (images.length + files.length > maxImages) return

    setUploading(true)
    try {
      const newImages: { url: string; r2Key: string }[] = []

      for (const file of Array.from(files)) {
        // Compress image
        const compressed = await imageCompression(file, {
          maxSizeMB: 5,
          maxWidthOrHeight: 1920,
          fileType: 'image/webp',
        })

        // Get presigned URL
        const { presignedUrl, r2Key, publicUrl } = await getPresignedUrl.mutateAsync({
          purpose,
          contentType: compressed.type || 'image/webp',
          fileSize: compressed.size,
        })

        // Upload to R2
        await fetch(presignedUrl, {
          method: 'PUT',
          body: compressed,
          headers: { 'Content-Type': compressed.type || 'image/webp' },
        })

        newImages.push({ url: publicUrl, r2Key })
      }

      onChange([...images, ...newImages])
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setUploading(false)
    }
  }, [images, maxImages, purpose, getPresignedUrl, onChange])

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index))
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap gap-3">
        {images.map((img, i) => (
          <div key={i} className="relative h-24 w-24 overflow-hidden rounded-lg border">
            <img src={img.url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeImage(i)}
              className="absolute right-1 top-1 rounded-full bg-black/50 p-0.5 text-white hover:bg-black/70"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {images.length < maxImages && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-24 w-24 flex-col items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <Upload className="h-6 w-6" />
                <span className="mt-1 text-xs">上傳</span>
              </>
            )}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={maxImages > 1}
        className="hidden"
        onChange={(e) => e.target.files && handleUpload(e.target.files)}
      />
    </div>
  )
}
