import { EmptyIcon, type EmptyIconName } from './empty-state-icons'

interface EmptyStateProps {
  icon: EmptyIconName
  title: string
  description?: string
  children?: React.ReactNode
}

export function EmptyState({ icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <EmptyIcon name={icon} className="mb-4 h-12 w-12" />
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
