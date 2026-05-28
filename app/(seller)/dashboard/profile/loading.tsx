import { Skeleton } from '@/components/ui/skeleton'

// 結構需與 app/(seller)/dashboard/profile/page.tsx 的真實版面對齊
// （max-w-2xl 容器 + 2 個 tab + 卡片內表單）。
export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Tabs：賣家資料 / 社群帳號 */}
      <div className="flex gap-2 border-b border-border pb-2">
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>

      {/* 表單卡片骨架（對齊 page.tsx isSellerLoading 時的骨架結構） */}
      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-5">
        <Skeleton className="h-6 w-24" />

        {/* 頭貼 */}
        <div className="grid grid-cols-[140px_1fr] items-start gap-x-4">
          <Skeleton className="mt-2 h-4 w-10" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>

        {/* 賣家名稱 */}
        <div className="grid grid-cols-[140px_1fr] items-start gap-x-4">
          <Skeleton className="mt-2 h-4 w-20" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>

        {/* 代購地區 */}
        <div className="grid grid-cols-[140px_1fr] items-start gap-x-4">
          <Skeleton className="mt-2 h-4 w-20" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>

        {/* 簡介 */}
        <div className="grid grid-cols-[140px_1fr] items-start gap-x-4">
          <Skeleton className="mt-2 h-4 w-10" />
          <Skeleton className="h-44 w-full rounded-md" />
        </div>

        {/* 儲存按鈕 */}
        <div className="grid grid-cols-[140px_1fr] items-start gap-x-4">
          <div />
          <Skeleton className="h-9 w-28 justify-self-end rounded-md" />
        </div>
      </div>
    </div>
  )
}
