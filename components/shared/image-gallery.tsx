'use client'

import { useEffect, useState } from 'react'
import { Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ImageLightbox } from '@/components/shared/image-lightbox'

export interface GalleryImage {
  url: string
  alt?: string
}

interface ImageGalleryProps {
  images: GalleryImage[]
  title?: string
  emptyTitle?: string
  emptyDescription?: string
  className?: string
}

export function ImageGallery({
  images,
  title,
  emptyTitle = '暫無圖片',
  emptyDescription = '目前沒有可瀏覽的圖片',
  className,
}: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)

  useEffect(() => {
    if (images.length === 0) {
      setActiveIndex(0)
      setViewerOpen(false)
      return
    }

    setActiveIndex((current) => Math.min(current, images.length - 1))
  }, [images.length])

  useEffect(() => {
    if (!viewerOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setViewerOpen(false)
        return
      }

      if (images.length <= 1) return

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setActiveIndex((current) => (current - 1 + images.length) % images.length)
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        setActiveIndex((current) => (current + 1) % images.length)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewerOpen, images.length])

  const activeImage = images[activeIndex]
  const hasMultipleImages = images.length > 1

  if (images.length === 0) {
    return (
      <div className={cn('rounded-3xl border border-dashed border-border/70 bg-muted/20 p-6 text-center', className)}>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-background text-muted-foreground shadow-sm ring-1 ring-border/60">
          <Maximize2 className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-base font-medium text-foreground">{emptyTitle}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <button
        type="button"
        onClick={() => setViewerOpen(true)}
        className="group relative block w-full cursor-zoom-in overflow-hidden rounded-2xl bg-muted ring-1 ring-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <div className={cn('relative overflow-hidden bg-muted/10', hasMultipleImages ? 'aspect-square' : 'aspect-square')}>
          <img
            src={activeImage.url}
            alt={activeImage.alt ?? title ?? '圖片'}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="eager"
            draggable={false}
          />
          <div className="absolute right-3 top-3 rounded-full bg-background/85 p-2 text-foreground shadow-sm ring-1 ring-border/60">
            <Maximize2 className="h-4 w-4" />
          </div>
        </div>
      </button>

      {hasMultipleImages && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => {
            const isActive = index === activeIndex
            return (
              <button
                key={`${image.url}-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={cn(
                  'relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-xl ring-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  isActive
                    ? 'ring-primary shadow-md shadow-primary/10'
                    : 'ring-border/60 opacity-70 hover:opacity-100'
                )}
                aria-label={`切換到第 ${index + 1} 張圖片`}
              >
                <img
                  src={image.url}
                  alt={image.alt ?? `${title ?? '圖片'} ${index + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  draggable={false}
                />
              </button>
            )
          })}
        </div>
      )}

      <ImageLightbox
        open={viewerOpen}
        images={images}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        onOpenChange={setViewerOpen}
      />
    </div>
  )
}
