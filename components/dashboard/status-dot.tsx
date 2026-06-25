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
    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
  ) : (
    <span className={cn('h-2 w-2 shrink-0 rounded-full bg-gray-400', dotClassName)} />
  )

  const inner = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.1em] text-muted-foreground md:tracking-[0.16em]',
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
