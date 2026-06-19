import { Skeleton } from '@/components/ui/skeleton'

// 共用：listings/new/loading.tsx、listings/[id]/edit/loading.tsx、
// 以及 listings/[id]/edit/page.tsx 的 internal isLoading 都使用同一份骨架，
// 避免「祖先列表骨架 → 簡陋內部骨架 → 真實表單」的多層跳動。
// 結構需與 app/(seller)/dashboard/listings/{new,[id]/edit}/page.tsx 對齊（含手機緊湊版）。
// 表單已分成 5 組（基本資訊／價格與庫存／規格／出貨與檔期／來源與說明），
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
      <Skeleton className="h-3 w-20 md:h-4 md:w-24" />
      <Skeleton className={`w-full rounded-lg ${inputClass}`} />
    </div>
  )
}

export function ListingFormSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 md:space-y-6">
      {/* 返回鈕 + 標題（手機 text-[15px]） */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg md:h-9 md:w-9" />
        <Skeleton className="h-5 w-28 md:h-8 md:w-32" />
      </div>

      {/* Card：商品卡 + 分組欄位 + 送出鈕（手機 p-4） */}
      <div className="space-y-6 rounded-xl border bg-white p-4 shadow-sm sm:p-8 md:space-y-8">
        {/* 商品 label + ProductCard 區（頁面層級） */}
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-12 md:h-4" />
          <Skeleton className="h-20 w-52 rounded-lg md:h-24 md:w-64" />
        </div>

        {/* 基本資訊：標題 + 圖片 */}
        <div className="space-y-4">
          <SectionHead />
          <FieldSkel />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-20 md:h-4 md:w-24" />
            <Skeleton className="h-20 w-full rounded-lg md:h-24" />
          </div>
        </div>

        {/* 價格與庫存：價格 + 現貨（並排） */}
        <div className="space-y-4">
          <SectionHead />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
            <FieldSkel />
            <FieldSkel inputClass="h-10 w-full sm:w-28" />
          </div>
        </div>

        {/* 規格：新增鈕 */}
        <div className="space-y-4">
          <SectionHead />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>

        {/* 出貨與檔期：兩個日期（並排） */}
        <div className="space-y-4">
          <SectionHead />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldSkel />
            <FieldSkel />
          </div>
        </div>

        {/* 來源與說明：連結 + 說明 */}
        <div className="space-y-4">
          <SectionHead />
          <FieldSkel />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-20 md:h-4 md:w-24" />
            <Skeleton className="h-20 w-full rounded-lg md:h-24" />
          </div>
        </div>

        {/* 動作列：儲存 + 送出 */}
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-8 w-24 rounded-lg md:h-10 md:w-28" />
          <Skeleton className="h-8 flex-1 rounded-lg md:h-10" />
        </div>
      </div>
    </div>
  )
}
