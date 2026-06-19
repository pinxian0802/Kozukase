import { Skeleton } from '@/components/ui/skeleton'

// 共用：connections/new/loading.tsx、connections/[id]/edit/loading.tsx、
// 以及 connections/[id]/edit/page.tsx 的 internal isLoading 都使用同一份骨架。
// 結構需與 app/(seller)/dashboard/connections/{new,[id]/edit}/page.tsx 對齊
// （max-w-4xl、手機 text-[15px] 標題、緊湊欄位）。
// 表單已分成 5 組（基本資訊／商品與地點／檔期／說明與計費／其他設定），
// 骨架以「分組標題 + 欄位」呈現，對齊真實表單的分隔線版型。

/** 分組標題骨架：小標題色塊 + 一條延伸到底的細線。 */
function SectionHead() {
  return (
    <div className="flex items-center gap-2.5">
      <Skeleton className="h-3 w-16 rounded" />
      <Skeleton className="h-px flex-1" />
    </div>
  )
}

/** 單一欄位骨架：標籤 + 輸入框。 */
function FieldSkel({ inputClass = 'h-[30px] md:h-10' }: { inputClass?: string }) {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-3 w-24 md:h-4" />
      <Skeleton className={`w-full rounded-lg ${inputClass}`} />
    </div>
  )
}

export function ConnectionFormSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 md:space-y-6">
      {/* 返回鈕 + 標題（手機 text-[15px]、電腦 sm:text-4xl） */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg md:h-9 md:w-9" />
        <Skeleton className="h-5 w-40 md:h-10 md:w-56" />
      </div>

      {/* Card：分組欄位 + 送出鈕 */}
      <div className="space-y-6 rounded-xl border bg-white p-4 shadow-sm sm:p-8 md:space-y-8">
        {/* 基本資訊：標題 + 國家 + 圖片 */}
        <div className="space-y-4">
          <SectionHead />
          <FieldSkel />
          <FieldSkel />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24 md:h-4" />
            <Skeleton className="h-20 w-full rounded-lg md:h-24" />
          </div>
        </div>

        {/* 商品與地點：品牌 + 地點 */}
        <div className="space-y-4">
          <SectionHead />
          <FieldSkel />
          <FieldSkel />
        </div>

        {/* 檔期：連線日期 + 出貨日期 */}
        <div className="space-y-4">
          <SectionHead />
          <FieldSkel />
          <FieldSkel />
        </div>

        {/* 說明與計費：兩個多行欄位 */}
        <div className="space-y-4">
          <SectionHead />
          <FieldSkel inputClass="h-24 md:h-28" />
          <FieldSkel inputClass="h-24 md:h-28" />
        </div>

        {/* 其他設定：連結 + 可許願 */}
        <div className="space-y-4">
          <SectionHead />
          <FieldSkel />
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>

        {/* 送出鈕（w-full） */}
        <Skeleton className="h-9 w-full rounded-lg md:h-10" />
      </div>
    </div>
  )
}
