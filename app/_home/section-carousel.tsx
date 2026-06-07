'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function SectionCarousel({
  title,
  viewAllHref,
  children,
}: {
  title: string
  viewAllHref: string
  children: React.ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 0)
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  const scroll = (dir: 1 | -1) => {
    scrollRef.current?.scrollBy({ left: dir * 360, behavior: 'smooth' })
  }

  return (
    <section className="mx-auto max-w-6xl px-3 py-3 md:px-4 md:py-8">
      <div className="mb-2 flex items-baseline justify-between md:mb-4">
        <h2 className="font-heading text-[14px] font-bold text-foreground md:text-2xl">{title}</h2>
        <Link href={viewAllHref} className="shrink-0 text-[11px] font-medium text-brand-700 hover:underline md:text-sm">
          看全部 →
        </Link>
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-4 md:flex-wrap xl:flex-nowrap xl:overflow-x-auto xl:scroll-smooth xl:pb-2 xl:snap-x"
        >
          {children}
        </div>

        {canScrollLeft && (
          <button
            type="button"
            aria-label="往左捲動"
            onClick={() => scroll(-1)}
            className="absolute -left-14 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border-soft bg-white p-2 shadow-md hover:bg-muted xl:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            aria-label="往右捲動"
            onClick={() => scroll(1)}
            className="absolute -right-14 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border-soft bg-white p-2 shadow-md hover:bg-muted xl:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </section>
  )
}
