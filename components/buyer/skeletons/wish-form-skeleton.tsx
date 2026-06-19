import { Skeleton } from '@/components/ui/skeleton'

// 對齊 app/(buyer)/wishes/new/page.tsx 的 <ProductForm/>：max-w-2xl 表單，
// 返回鈕 + 「新增商品」標題 + 分組欄位（基本資訊／商品屬性）+ 下一步按鈕。

/** 分組標題骨架：小標題色塊 + 一條延伸到底的細線。 */
function SectionHead() {
  return (
    <div className="flex items-center gap-2.5">
      <Skeleton className="h-3 w-16 rounded" />
      <Skeleton className="h-px flex-1" />
    </div>
  )
}

export function WishFormSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      {/* 返回鈕 + 標題 */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-8 w-32" />
      </div>

      <div className="space-y-6 md:space-y-8">
        {/* 基本資訊：圖片 + 名稱 */}
        <div className="space-y-4">
          <SectionHead />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-40 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>

        {/* 商品屬性：品牌+型號、分類+國家（並排） */}
        <div className="space-y-4">
          <SectionHead />
          {Array.from({ length: 2 }).map((_, row) => (
            <div key={row} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, col) => (
                <div key={col} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* 取消 / 下一步 */}
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-10 w-20 rounded-md" />
          <Skeleton className="h-10 w-24 rounded-md" />
        </div>
      </div>
    </div>
  )
}
