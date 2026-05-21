import { cn } from '@/lib/utils'

export type DashboardStatusDotProps = {
  label: string
  dotClassName?: string
  className?: string
}

export function DashboardStatusDot({ label, dotClassName, className }: DashboardStatusDotProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.16em] text-muted-foreground',
        className,
      )}
    >
      <span className={cn('h-2 w-2 shrink-0 rounded-full bg-gray-400', dotClassName)} />
      {label}
    </span>
  )
}
