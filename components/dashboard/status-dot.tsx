import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

export type DashboardStatusDotProps = {
  label: string
  dotClassName?: string
  className?: string
  warning?: string | null
}

export function DashboardStatusDot({ label, dotClassName, className, warning }: DashboardStatusDotProps) {
  const icon = warning ? (
    <AlertTriangle className="h-3 w-3 shrink-0 text-red-500 md:h-3.5 md:w-3.5" />
  ) : (
    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400 md:h-2 md:w-2', dotClassName)} />
  )

  const inner = (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-medium tracking-[0.08em] text-muted-foreground md:gap-1.5 md:text-xs md:tracking-[0.16em]',
        className,
      )}
    >
      {icon}
      {label}
    </span>
  )

  if (!warning) return inner

  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>
        {inner}
      </TooltipTrigger>
      <TooltipContent side="top">原因：{warning}</TooltipContent>
    </Tooltip>
  )
}
