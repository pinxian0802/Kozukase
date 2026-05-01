import type { ComponentProps, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { getSafeExternalHref } from '@/lib/utils/safe-url'

type ButtonProps = ComponentProps<typeof Button>

type SafeExternalLinkProps = Omit<ButtonProps, 'render' | 'nativeButton'> & {
  href: string | null | undefined
  children: ReactNode
  target?: '_blank' | '_self' | '_parent' | '_top'
  rel?: string
}

export function SafeExternalLink({
  href,
  children,
  target = '_blank',
  rel = 'noopener noreferrer nofollow',
  ...buttonProps
}: SafeExternalLinkProps) {
  const safeHref = getSafeExternalHref(href)
  if (!safeHref) return null

  return (
    <Button
      {...buttonProps}
      render={<a href={safeHref} target={target} rel={rel} />}
    >
      {children}
    </Button>
  )
}