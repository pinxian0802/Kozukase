'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, Globe, UserCog, Shield, Flag, Tags, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  mode: 'seller' | 'admin'
}

const sellerLinks = [
  { href: '/dashboard', label: '總覽', icon: LayoutDashboard },
  { href: '/dashboard/listings', label: '代購管理', icon: Package },
  { href: '/dashboard/connections', label: '連線管理', icon: Globe },
  { href: '/dashboard/profile', label: '賣家資料', icon: UserCog },
]

const adminLinks = [
  { href: '/admin', label: '總覽', icon: LayoutDashboard },
  { href: '/admin/users', label: '使用者管理', icon: Shield },
  { href: '/admin/products', label: '商品管理', icon: Package },
  { href: '/admin/listings', label: '代購審核', icon: Package },
  { href: '/admin/connections', label: '連線審核', icon: Globe },
  { href: '/admin/reports', label: '檢舉處理', icon: Flag },
  { href: '/admin/sellers', label: '賣家管理', icon: Users },
  { href: '/admin/categories', label: '分類管理', icon: Tags },
]

export function Sidebar({ mode }: SidebarProps) {
  const pathname = usePathname()
  const links = mode === 'seller' ? sellerLinks : adminLinks

  return (
    <aside className="hidden md:flex w-60 flex-col border-r bg-background px-3 py-6">
      <h2 className="mb-4 px-3 font-heading text-sm font-semibold text-foreground uppercase tracking-wider">
        {mode === 'seller' ? '賣家後台' : '管理後台'}
      </h2>
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
                  ? 'bg-muted text-foreground font-medium'
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
  )
}
