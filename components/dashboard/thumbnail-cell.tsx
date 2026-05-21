'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Images, Maximize2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ImageLightbox } from '@/components/shared/image-lightbox'

export type DashboardThumbnailImage = {
  url: string
  alt?: string
}

export type DashboardThumbnailCellProps = {
  images: DashboardThumbnailImage[]
  title: string
  fallbackIcon: LucideIcon
  size?: number
  className?: string
}

export function DashboardThumbnailCell({
  images,
  title,
  fallbackIcon: FallbackIcon,
  size = 64,
  className,
}: DashboardThumbnailCellProps) {
  const [viewerOpen, setViewerOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const sizeStyle = { width: size, height: size }

  if (images.length === 0) {
    return (
      <div
        style={sizeStyle}
        className={cn(
          'relative shrink-0 overflow-hidden rounded-lg border bg-muted/40',
          className,
        )}
      >
        <div className="flex h-full items-center justify-center text-muted-foreground/50">
          <FallbackIcon className="h-1/2 w-1/2" />
        </div>
      </div>
    )
  }

  const currentIndex = Math.min(activeIndex, Math.max(images.length - 1, 0))
  const activeImage = images[currentIndex] ?? images[0]
  const isLocalPreviewUrl =
    activeImage.url.startsWith('blob:') || activeImage.url.startsWith('data:')

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setViewerOpen(true)
        }}
        style={sizeStyle}
        className={cn(
          'group relative shrink-0 cursor-pointer overflow-hidden rounded-lg border bg-muted/40 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          className,
        )}
        aria-label={`預覽 ${title}`}
      >
        <Image
          src={activeImage.url}
          alt={activeImage.alt ?? title}
          fill
          sizes={`${size}px`}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          unoptimized={isLocalPreviewUrl}
        />
        {images.length > 1 && (
          <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="inline-flex min-w-0 items-center gap-0.5 truncate">
              <Images className="h-3 w-3 shrink-0" />
              {images.length}
            </span>
            <Maximize2 className="h-3 w-3 shrink-0" />
          </div>
        )}
      </button>

      <ImageLightbox
        open={viewerOpen}
        images={images}
        activeIndex={currentIndex}
        onActiveIndexChange={setActiveIndex}
        onOpenChange={setViewerOpen}
      />
    </>
  )
}
