'use client'

import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type LightboxImage = {
  url: string
  alt?: string
}

interface ImageLightboxProps {
  open: boolean
  images: LightboxImage[]
  activeIndex: number
  onActiveIndexChange: React.Dispatch<React.SetStateAction<number>>
  onOpenChange: (open: boolean) => void
  className?: string
}

export function ImageLightbox({
  open,
  images,
  activeIndex,
  onActiveIndexChange,
  onOpenChange,
  className,
}: ImageLightboxProps) {
  const [shouldRender, setShouldRender] = useState(open)
  const [isVisible, setIsVisible] = useState(open)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasMultipleImages = images.length > 1
  const currentIndex = Math.min(activeIndex, Math.max(images.length - 1, 0))
  const currentImage = images[currentIndex]

  useEffect(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }

    if (open) {
      setShouldRender(true)
      const frame = requestAnimationFrame(() => setIsVisible(true))
      return () => cancelAnimationFrame(frame)
    }

    setIsVisible(false)
    closeTimerRef.current = setTimeout(() => setShouldRender(false), 200)
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false)
        return
      }

      if (!hasMultipleImages) return

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onActiveIndexChange((current) => (current - 1 + images.length) % images.length)
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        onActiveIndexChange((current) => (current + 1) % images.length)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [hasMultipleImages, images.length, onActiveIndexChange, onOpenChange, open])

  if (!shouldRender || !currentImage) return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-1000 bg-slate-950/70 backdrop-blur-md transition-opacity duration-200 ease-out',
        isVisible ? 'opacity-100' : 'opacity-0',
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-label="圖片預覽"
      onClick={() => onOpenChange(false)}
    >
      <button
        type="button"
        aria-label="關閉預覽"
        onClick={(event) => {
          event.stopPropagation()
          onOpenChange(false)
        }}
        className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      {hasMultipleImages && (
        <button
          type="button"
          aria-label="上一張"
          onClick={(event) => {
            event.stopPropagation()
            onActiveIndexChange((current) => (current - 1 + images.length) % images.length)
          }}
          className="absolute left-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      <div
        className={cn(
          'flex h-full w-full items-center justify-center p-4 transition-all duration-200 ease-out sm:p-8',
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={currentImage.url}
          alt={currentImage.alt ?? '圖片'}
          className="max-h-[90vh] max-w-[92vw] select-none object-contain sm:max-h-[94vh] sm:max-w-[88vw]"
          draggable={false}
        />
      </div>

      {hasMultipleImages && (
        <button
          type="button"
          aria-label="下一張"
          onClick={(event) => {
            event.stopPropagation()
            onActiveIndexChange((current) => (current + 1) % images.length)
          }}
          className="absolute right-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
    </div>,
    document.body
  )
}
