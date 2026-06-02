import type { ReactNode } from 'react'

import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type FilterTabItem = {
  value: string
  label: ReactNode
  /** 有值才渲染計數膠囊；undefined 則只顯示文字標籤 */
  count?: number
}

/**
 * line 變體的篩選 tab bar（styled TabsList + triggers + 計數膠囊）。
 * 刻意不包 <Tabs> root，呼叫端保留自己的 <Tabs> 外殼與 <TabsContent>。
 */
export function FilterTabsList({
  items,
  className,
}: {
  items: FilterTabItem[]
  className?: string
}) {
  return (
    <TabsList
      variant="pill"
      className={cn('w-full', className)}
    >
      {items.map(({ value, label, count }) => (
        <TabsTrigger key={value} value={value} className="group">
          {label}
          {count !== undefined && (
            <span className="ml-0.5 text-[11px] font-semibold px-1.5 py-px rounded-full bg-background text-muted-foreground group-data-active:bg-white/25 group-data-active:text-white">
              {count}
            </span>
          )}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}
