import { Skeleton } from '@/components/ui/skeleton'

// 對齊 app/(buyer)/wishes/new/page.tsx 的 <ProductForm/>：max-w-2xl 表單，
// 返回鈕 + 「新增商品」標題 + 多欄欄位 + 下一步按鈕。
export function WishFormSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      {/* 返回鈕 + 標題 */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-8 w-32" />
      </div>

      <div className="space-y-5">
        {/* 商品圖片 */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-40 w-full rounded-md" />
        </div>

        {/* 5 個一般欄位 */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}

        {/* 取消 / 下一步 */}
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-10 w-20 rounded-md" />
          <Skeleton className="h-10 w-24 rounded-md" />
        </div>
      </div>
    </div>
  )
}
