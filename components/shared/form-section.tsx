import type { ReactNode } from 'react'

/**
 * 選填欄位的灰色膠囊標籤。必填欄位維持乾淨不標，使用者預設「沒標的就是要填」。
 * 四個代購相關表單（標單／求購／商品／連線）共用同一個標示規則。
 */
export function OptionalTag() {
  return (
    <span className="ml-1.5 align-middle rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      選填
    </span>
  )
}

/**
 * 表單分組標題：小標題 + 一條延伸到底的細分隔線（輕量分隔線樣式）。
 * 外層已是卡片，故不再加背景／邊框，避免雙重框。
 */
export function FormSection({
  title,
  optional,
  children,
}: {
  title: string
  optional?: boolean
  children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2.5 text-xs font-bold tracking-wide text-muted-foreground">
        <span className="flex items-center whitespace-nowrap">
          {title}
          {optional && <OptionalTag />}
        </span>
        <span className="h-px flex-1 bg-border" />
      </h2>
      {children}
    </section>
  )
}
