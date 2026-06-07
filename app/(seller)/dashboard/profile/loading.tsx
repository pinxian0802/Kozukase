import { Skeleton } from '@/components/ui/skeleton'

// 結構需與 app/(seller)/dashboard/profile/page.tsx 的真實版面對齊
// （max-w-2xl 容器 + pill tabs + size=sm 卡片 + 手機 flex-col 表單列）。
export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 md:space-y-6">
      {/* Tabs（pill）：賣家資料 / 社群帳號 */}
      <div className="flex flex-wrap gap-1.5 md:gap-2">
        <Skeleton className="h-6 w-16 rounded-full md:h-9 md:w-20" />
        <Skeleton className="h-6 w-16 rounded-full md:h-9 md:w-20" />
      </div>

      {/* 表單卡片（size=sm：手機 p-3、電腦 p-5） */}
      <div className="space-y-3 rounded-xl border bg-white p-3 shadow-sm md:space-y-5 md:p-5">
        <Skeleton className="h-4 w-20 md:h-5 md:w-24" />

        {/* 頭貼（手機 flex-col、頭像置中） */}
        <div className="flex flex-col gap-1.5 md:grid md:grid-cols-[140px_1fr] md:items-start md:gap-x-4">
          <Skeleton className="h-3 w-10 md:mt-2 md:h-4" />
          <div className="flex justify-center md:justify-start">
            <Skeleton className="h-24 w-24 rounded-full" />
          </div>
        </div>

        {/* 賣家名稱 / 代購地區 */}
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5 md:grid md:grid-cols-[140px_1fr] md:items-start md:gap-x-4">
            <Skeleton className="h-3 w-16 md:mt-2 md:h-4 md:w-20" />
            <Skeleton className="h-[30px] w-full rounded-lg md:h-10" />
          </div>
        ))}

        {/* 簡介 */}
        <div className="flex flex-col gap-1.5 md:grid md:grid-cols-[140px_1fr] md:items-start md:gap-x-4">
          <Skeleton className="h-3 w-10 md:mt-2 md:h-4" />
          <Skeleton className="h-20 w-full rounded-lg md:h-44" />
        </div>

        {/* 儲存按鈕 */}
        <div className="md:grid md:grid-cols-[140px_1fr] md:gap-x-4">
          <div className="hidden md:block" />
          <Skeleton className="ml-auto h-8 w-24 rounded-lg md:h-9 md:w-28" />
        </div>
      </div>
    </div>
  )
}
