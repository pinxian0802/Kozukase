import { Skeleton } from '@/components/ui/skeleton'

// 對齊 app/(buyer)/wishes/new/page.tsx 的第一個畫面 <ProductPicker/>：
// 返回鈕 + 「選擇或新增商品」標題 + 說明文字 + 搜尋框。

export function WishFormSkeleton() {
  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-4 md:space-y-6">
        {/* 返回鈕 + 標題 */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-40" />
        </div>

        {/* 說明文字 */}
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>

        {/* 搜尋框 */}
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </div>
  )
}
