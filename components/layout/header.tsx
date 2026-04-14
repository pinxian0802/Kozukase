'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search, Menu, X, User, Bell, LogOut, Store, Heart, Star, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { trpc } from '@/lib/trpc/client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { NotificationBell } from '@/components/shared/notification-bell'

export function Header() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { data: session } = trpc.auth.getSession.useQuery()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setMobileSearchOpen(false)
    }
  }

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0 font-heading text-2xl font-bold text-primary">
          Daigo
        </Link>

        {/* Desktop Search */}
        <form onSubmit={handleSearch} className="hidden flex-1 md:flex max-w-lg">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋商品名稱或品牌..."
              className="pl-10"
            />
          </div>
        </form>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-2">
          <Button variant="ghost" size="sm" render={<Link href="/connections" />}>
            連線代購
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/wishes" />}>
            許願榜
          </Button>
        </nav>

        {/* Auth Section */}
        <div className="ml-auto flex items-center gap-2">
          {/* Mobile Search Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
          >
            <Search className="h-5 w-5" />
          </Button>

          {session?.profile ? (
            <>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative" />}>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={session.profile.avatar_url ?? undefined} />
                      <AvatarFallback>{session.profile.display_name?.[0] ?? '?'}</AvatarFallback>
                    </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem render={<Link href="/profile" />}>
                    <User className="mr-2 h-4 w-4" />個人頁面
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/notifications" />}>
                    <Bell className="mr-2 h-4 w-4" />通知
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/profile?tab=bookmarks" />}>
                    <Heart className="mr-2 h-4 w-4" />我的收藏
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {session.isSeller ? (
                    <DropdownMenuItem render={<Link href="/dashboard" />}>
                      <Store className="mr-2 h-4 w-4" />賣家後台
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem render={<Link href="/settings" />}>
                      <Store className="mr-2 h-4 w-4" />成為賣家
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />登出
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button size="sm" render={<Link href="/login" />}>
              登入
            </Button>
          )}

          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
                <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <nav className="flex flex-col gap-2 pt-8">
                <Button variant="ghost" className="justify-start" onClick={() => setMobileMenuOpen(false)} render={<Link href="/search" />}>
                  搜尋商品
                </Button>
                <Button variant="ghost" className="justify-start" onClick={() => setMobileMenuOpen(false)} render={<Link href="/connections" />}>
                  連線代購
                </Button>
                <Button variant="ghost" className="justify-start" onClick={() => setMobileMenuOpen(false)} render={<Link href="/wishes" />}>
                  許願榜
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Mobile Search Bar */}
      {mobileSearchOpen && (
        <div className="border-t px-4 py-2 md:hidden">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋商品名稱或品牌..."
                className="pl-10"
                autoFocus
              />
            </div>
          </form>
        </div>
      )}
    </header>
  )
}
