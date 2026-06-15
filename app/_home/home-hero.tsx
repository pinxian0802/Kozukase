'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export type HeroSlide = {
  id: string
  src: string
  href?: string | null
  alt?: string
}

const AUTOPLAY_MS = 5000

export function HomeHero({
  slides,
  arrowsInside = false,
}: {
  slides: HeroSlide[]
  /** true:箭頭顯示在圖片內側、各尺寸都顯示(預覽用);預設:圖外、僅 xl 顯示(首頁) */
  arrowsInside?: boolean
}) {
  const count = slides.length
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const arrowBase =
    'absolute top-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border-soft bg-white p-2 shadow-md transition hover:bg-muted'
  const leftArrowCls = arrowsInside
    ? `${arrowBase} left-2 flex`
    : `${arrowBase} -left-14 hidden xl:flex`
  const rightArrowCls = arrowsInside
    ? `${arrowBase} right-2 flex`
    : `${arrowBase} -right-14 hidden xl:flex`

  const goTo = useCallback((i: number) => setIndex((i + count) % count), [count])
  const next = useCallback(() => goTo(index + 1), [goTo, index])
  const prev = useCallback(() => goTo(index - 1), [goTo, index])

  useEffect(() => {
    if (paused || count <= 1) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS)
    return () => clearInterval(timer)
  }, [paused, count])

  if (count === 0) return null

  return (
    <section className="mx-auto max-w-6xl px-3 pt-3 md:px-4 md:pt-6">
      <div
        className="relative"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* 圖片區(裁切滑動軌道) */}
        <div
          className="relative overflow-hidden rounded-xl border border-border-soft bg-muted"
          aria-roledescription="carousel"
          aria-label="宣傳橫幅"
        >
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((slide, i) => {
              const inner = (
                <div className="relative aspect-[5/2] w-full md:aspect-[16/5]">
                  <Image
                    src={slide.src}
                    alt={slide.alt ?? ''}
                    fill
                    priority={i === 0}
                    sizes="(min-width: 1152px) 1152px, 100vw"
                    className="object-cover"
                  />
                </div>
              )
              return (
                <div key={slide.id} className="w-full shrink-0" aria-hidden={i !== index}>
                  {slide.href ? (
                    <Link href={slide.href} aria-label={slide.alt || '宣傳橫幅'}>
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </div>
              )
            })}
          </div>

          {/* 圓點 */}
          {count > 1 && (
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`切換到第 ${i + 1} 張`}
                  aria-current={i === index}
                  onClick={() => goTo(i)}
                  className={
                    i === index
                      ? 'h-2 w-6 rounded-full bg-white transition-all'
                      : 'h-2 w-2 rounded-full bg-white/60 transition-all hover:bg-white/80'
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* 左右箭頭(放在圖片外,僅 xl 以上顯示,沿用熱門商品樣式) */}
        {count > 1 && (
          <>
            <button type="button" aria-label="上一張" onClick={prev} className={leftArrowCls}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" aria-label="下一張" onClick={next} className={rightArrowCls}>
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </section>
  )
}
