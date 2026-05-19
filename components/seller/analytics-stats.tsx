'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Eye, Users, Camera, AtSign, MessageCircle, Bookmark, UserPlus, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { trpc } from '@/lib/trpc/client'

type Days = 7 | 30 | 90

interface StatCardProps {
  label: string
  icon: React.ReactNode
  current: number
  trend: number
}

function StatCard({ label, icon, current, trend }: StatCardProps) {
  const isUp = trend > 0
  const isDown = trend < 0

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <span className="text-muted-foreground/50">{icon}</span>
      </div>
      <span className="text-2xl font-bold tabular-nums">{current.toLocaleString()}</span>
      <div className="flex items-center gap-1 text-xs">
        {isUp && <TrendingUp className="h-3.5 w-3.5 text-green-500" />}
        {isDown && <TrendingDown className="h-3.5 w-3.5 text-red-400" />}
        {!isUp && !isDown && <Minus className="h-3.5 w-3.5 text-muted-foreground/40" />}
        <span className={isUp ? 'text-green-600' : isDown ? 'text-red-500' : 'text-muted-foreground'}>
          {trend > 0 ? `+${trend}%` : trend < 0 ? `${trend}%` : '持平'}
        </span>
        <span className="text-muted-foreground">vs 上一期</span>
      </div>
    </div>
  )
}

export function AnalyticsStats() {
  const [days, setDays] = useState<Days>(30)
  const { data, isLoading } = trpc.analytics.getSellerStats.useQuery({ days })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">數據總覽</h2>
        <div className="flex gap-1">
          {([7, 30, 90] as Days[]).map(d => (
            <Button
              key={d}
              variant={days === d ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setDays(d)}
            >
              {d} 天
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : data ? (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <StatCard label="刊登瀏覽" icon={<Eye className="h-4 w-4" />} current={data.listingViews.current} trend={data.listingViews.trend} />
          <StatCard label="主頁訪客" icon={<Users className="h-4 w-4" />} current={data.profileViews.current} trend={data.profileViews.trend} />
          <StatCard label="IG 點擊" icon={<Camera className="h-4 w-4" />} current={data.igClicks.current} trend={data.igClicks.trend} />
          <StatCard label="Threads 點擊" icon={<AtSign className="h-4 w-4" />} current={data.threadsClicks.current} trend={data.threadsClicks.trend} />
          <StatCard label="收到詢問" icon={<MessageCircle className="h-4 w-4" />} current={data.inquiries.current} trend={data.inquiries.trend} />
          <StatCard label="新增書籤" icon={<Bookmark className="h-4 w-4" />} current={data.bookmarks.current} trend={data.bookmarks.trend} />
          <StatCard label="新增追蹤" icon={<UserPlus className="h-4 w-4" />} current={data.newFollowers.current} trend={data.newFollowers.trend} />
          <StatCard label="心願符合" icon={<Heart className="h-4 w-4" />} current={data.wishMatches.current} trend={data.wishMatches.trend} />
        </div>
      ) : null}
    </div>
  )
}
