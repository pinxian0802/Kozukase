import { cn } from '@/lib/utils'

interface FormFieldErrorProps {
  message?: string | null
  className?: string
}

export function FormFieldError({ message, className }: FormFieldErrorProps) {
  if (!message) return null

  return <p className={cn('mt-1 text-sm text-destructive', className)}>{message}</p>
}