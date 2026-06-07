'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Eye, Users, Camera, AtSign, MessageCircle, Bookmark, UserPlus, Heart, Package, MapPin, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { trpc } from '@/lib/trpc/client'

type Days = 7 | 30 | 90

interface StatCardProps {
  label: string
  icon: React.ReactNode
  current: number
  trend: number
  className?: string
}

function StatCard({ label, icon, current, trend, className }: StatCardProps) {
  const isUp = trend > 0
  const isDown = trend < 0

  return (
    <div className={cn('flex flex-col rounded-lg border bg-white p-2 shadow-sm md:rounded-xl md:p-4', className)}>
      <span className="text-[11px] text-muted-foreground font-medium md:text-xs">{label}</span>
      <span className="text-base font-bold tabular-nums mt-1 md:text-2xl md:mt-2">{current.toLocaleString()}</span>
      <div className="flex items-center gap-0.5 mt-1 md:mt-2 md:gap-1">
        {isUp && <TrendingUp className="h-2.5 w-2.5 text-green-500 md:h-3.5 md:w-3.5" />}
        {isDown && <TrendingDown className="h-2.5 w-2.5 text-red-400 md:h-3.5 md:w-3.5" />}
        {!isUp && !isDown && <Minus className="h-2.5 w-2.5 text-muted-foreground/40 md:h-3.5 md:w-3.5" />}
        <span className={`text-[10px] md:text-xs ${isUp ? 'text-green-600' : isDown ? 'text-red-500' : 'text-muted-foreground'}`}>
          {trend > 0 ? `+${trend}%` : trend < 0 ? `${trend}%` : '持平'}
        </span>
      </div>
    </div>
  )
}

export function AnalyticsStats() {
  const [days, setDays] = useState<Days>(30)
  const [expanded, setExpanded] = useState(false)
  const { data, isLoading } = trpc.analytics.getSellerStats.useQuery({ days })

  return (
    <div className="space-y-2 md:space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[12px] font-semibold md:text-sm">數據總覽</h2>
        <div className="flex gap-0.5 md:gap-1">
          {([7, 30, 90] as Days[]).map(d => (
            <Button
              key={d}
              variant={days === d ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-2.5 text-[11px] md:h-7 md:px-3 md:text-xs"
              onClick={() => setDays(d)}
            >
              {d}天
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <>
          <div className="grid gap-2 grid-cols-2 md:grid-cols-4 md:gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className={`h-[68px] rounded-lg md:h-28 md:rounded-xl ${i >= 4 ? 'max-md:hidden' : ''}`} />
            ))}
          </div>
          <Skeleton className="mx-auto h-4 w-20 md:hidden" />
        </>
      ) : data ? (
        <>
          <div className="grid gap-2 grid-cols-2 md:grid-cols-4 md:gap-3">
            <StatCard label="刊登瀏覽" icon={<Eye className="h-4 w-4" />} current={data.listingViews.current} trend={data.listingViews.trend} />
            <StatCard label="主頁訪客" icon={<Users className="h-4 w-4" />} current={data.profileViews.current} trend={data.profileViews.trend} />
            <StatCard label="IG 點擊" icon={<Camera className="h-4 w-4" />} current={data.igClicks.current} trend={data.igClicks.trend} />
            <StatCard label="Threads 點擊" icon={<AtSign className="h-4 w-4" />} current={data.threadsClicks.current} trend={data.threadsClicks.trend} />
            <StatCard label="收到詢問" icon={<MessageCircle className="h-4 w-4" />} current={data.inquiries.current} trend={data.inquiries.trend} className={expanded ? undefined : 'max-md:hidden'} />
            {/* 暫時隱藏：新增書籤 */}
            {/* <StatCard label="新增書籤" icon={<Bookmark className="h-4 w-4" />} current={data.bookmarks.current} trend={data.bookmarks.trend} /> */}
            <StatCard label="新增追蹤" icon={<UserPlus className="h-4 w-4" />} current={data.newFollowers.current} trend={data.newFollowers.trend} className={expanded ? undefined : 'max-md:hidden'} />
            {/* 暫時隱藏：心願符合 */}
            {/* <StatCard label="心願符合" icon={<Heart className="h-4 w-4" />} current={data.wishMatches.current} trend={data.wishMatches.trend} /> */}
            <StatCard label="商品瀏覽" icon={<Package className="h-4 w-4" />} current={data.productViews.current} trend={data.productViews.trend} className={expanded ? undefined : 'max-md:hidden'} />
            <StatCard label="連線瀏覽" icon={<MapPin className="h-4 w-4" />} current={data.connectionViews.current} trend={data.connectionViews.trend} className={expanded ? undefined : 'max-md:hidden'} />
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-center gap-1 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground md:hidden"
          >
            {expanded ? <>收起<ChevronUp className="h-3.5 w-3.5" /></> : <>展開更多<ChevronDown className="h-3.5 w-3.5" /></>}
          </button>
        </>
      ) : null}
    </div>
  )
}
