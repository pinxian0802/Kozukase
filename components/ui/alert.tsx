import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Alert — 編輯式眉標樣式（Swiss / 雜誌風）。
 * 白底 + 左側 3px 實心強調條 + 上方小眉標（注意 / 已下架…）+ 標題 + 內文。
 * 不用整片柔色塊，靠 hairline 邊框、單一強調色與字體層級撐質感。
 * 所有顏色走設計系統語意 token。
 */
type Variant = "info" | "success" | "warning" | "destructive"

const VARIANT: Record<
  Variant,
  { borderL: string; accentText: string; accentBg: string; label: string }
> = {
  info: {
    borderL: "border-l-info",
    accentText: "text-info-fg-soft",
    accentBg: "bg-info",
    label: "提醒",
  },
  success: {
    borderL: "border-l-success",
    accentText: "text-success-fg-soft",
    accentBg: "bg-success",
    label: "完成",
  },
  warning: {
    borderL: "border-l-warning",
    accentText: "text-warning-fg-soft",
    accentBg: "bg-warning",
    label: "注意",
  },
  destructive: {
    borderL: "border-l-destructive",
    accentText: "text-destructive",
    accentBg: "bg-destructive",
    label: "警告",
  },
}

type AlertProps = React.ComponentProps<"div"> & {
  variant?: Variant
  /** 主標題（粗體）。 */
  title?: React.ReactNode
  /** 眉標文字，預設依 variant（注意 / 警告…）；傳 null 可隱藏整個眉標。 */
  label?: React.ReactNode | null
}

function Alert({
  className,
  variant = "info",
  title,
  label,
  children,
  ...props
}: AlertProps) {
  const v = VARIANT[variant]
  const eyebrow = label === undefined ? v.label : label

  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(
        "w-full rounded-lg rounded-l-[3px] border border-l-[3px] border-border bg-card py-2.5 pr-3.5 pl-3.5 sm:py-3 sm:pr-4 sm:pl-4",
        v.borderL,
        className
      )}
      {...props}
    >
      {eyebrow !== null && (
        <div className="flex items-center gap-1.5">
          <span className={cn("size-1.5 shrink-0 rounded-full", v.accentBg)} aria-hidden />
          <span
            className={cn(
              "text-[10.5px] font-semibold tracking-[0.08em] uppercase sm:text-[11px]",
              v.accentText
            )}
          >
            {eyebrow}
          </span>
        </div>
      )}
      {title && (
        <p className="mt-1 text-[13.5px] font-semibold leading-snug tracking-tight text-balance text-foreground sm:text-[14px]">
          {title}
        </p>
      )}
      {children && (
        <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground sm:text-[13px]">
          {children}
        </div>
      )}
    </div>
  )
}

export { Alert }
