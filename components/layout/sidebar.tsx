'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, Globe, UserCog, Shield, Flag, Tags, Users, CalendarDays, Images, FlaskConical } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface SidebarProps {
  mode: 'seller' | 'admin'
  sellerProfile?: {
    username: string
    name: string
    avatarUrl: string | null
  }
}

const sellerLinks = [
  { href: '/dashboard', label: '總覽', icon: LayoutDashboard },
  { href: '/dashboard/listings', label: '代購管理', icon: Package },
  { href: '/dashboard/connections', label: '連線管理', icon: Globe },
  { href: '/dashboard/profile', label: '賣家帳號', icon: UserCog },
]

const adminLinks = [
  { href: '/admin', label: '總覽', icon: LayoutDashboard },
  { href: '/admin/today', label: '今日新增', icon: CalendarDays },
  { href: '/admin/users', label: '使用者管理', icon: Shield },
  { href: '/admin/products', label: '商品管理', icon: Package },
  { href: '/admin/listings', label: '代購審核', icon: Package },
  { href: '/admin/connections', label: '連線審核', icon: Globe },
  { href: '/admin/reports', label: '檢舉處理', icon: Flag },
  { href: '/admin/sellers', label: '賣家管理', icon: Users },
  { href: '/admin/social-verification', label: '社群驗證', icon: UserCog },
  { href: '/admin/categories', label: '分類管理', icon: Tags },
  { href: '/admin/banners', label: '輪播管理', icon: Images },
  { href: '/admin/toast-test', label: 'Toast 測試', icon: FlaskConical },
]

export function Sidebar({ mode, sellerProfile }: SidebarProps) {
  const pathname = usePathname()
  const links = mode === 'seller' ? sellerLinks : adminLinks

  const mobileLinks = mode === 'seller' ? sellerLinks : adminLinks.slice(0, 5)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r bg-background px-3 py-6">
        <h2 className="mb-4 px-3 font-heading text-sm font-semibold text-foreground uppercase tracking-wider">
          {mode === 'seller' ? '賣家後台' : '管理後台'}
        </h2>
        {mode === 'seller' && sellerProfile ? (
          <div className="mb-6 flex flex-col items-center px-3 text-center">
            <Avatar className="mb-3 h-20 w-20">
              {sellerProfile.avatarUrl ? <AvatarImage src={sellerProfile.avatarUrl} alt={sellerProfile.name} /> : null}
              <AvatarFallback className="bg-zinc-200 text-zinc-500">
                <span className="sr-only">無賣家頭貼</span>
              </AvatarFallback>
            </Avatar>
            <p className="max-w-full break-all text-xs text-muted-foreground">@{sellerProfile.username}</p>
            <p className="mt-1 max-w-full break-words text-sm font-semibold text-foreground">{sellerProfile.name}</p>
          </div>
        ) : null}
        <nav className="flex flex-col gap-0.5">
          {links.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href || (link.href !== '/dashboard' && link.href !== '/admin' && pathname.startsWith(link.href))
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-brand-100 text-brand-700 font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-border-soft bg-background/95 backdrop-blur-sm md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {mobileLinks.map((link) => {
          const Icon = link.icon
          const isActive = pathname === link.href || (link.href !== '/dashboard' && link.href !== '/admin' && pathname.startsWith(link.href))
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-1.5 text-center transition-colors',
                isActive ? 'text-brand-700' : 'text-muted-foreground'
              )}
            >
              <span className={cn(
                'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                isActive ? 'bg-brand-100' : 'bg-transparent'
              )}>
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="text-[10px] font-medium">{link.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
