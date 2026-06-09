import { Skeleton } from '@/components/ui/skeleton'

// 對齊 app/(buyer)/wishes/page.tsx：左側篩選欄 + 標題卡 + 桌機 3 欄許願卡片 grid。
export function WishesListSkeleton() {
  return (
    <div className="min-h-screen bg-surface-page">
      <div className="mx-auto max-w-6xl px-3 py-3 md:px-4 md:py-6">
        <div className="flex items-start gap-6">
          {/* Desktop sidebar */}
          <aside className="hidden w-64 shrink-0 md:block">
            <div className="space-y-4 pr-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-[24px]" />
              ))}
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <Skeleton className="mb-4 hidden h-28 rounded-2xl md:block" />
            <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl md:aspect-auto md:h-64" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
