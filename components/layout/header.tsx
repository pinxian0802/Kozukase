'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Search, Menu, Bell, LogOut, Store, Heart, Settings, MessageCircle } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useSession } from '@/lib/context/session-context'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { NotificationBell } from '@/components/shared/notification-bell'
import { MessageBell } from '@/components/shared/message-bell'
import { UserChannelListener } from '@/components/layout/user-channel-listener'

export function Header({ showSubNav = true }: { showSubNav?: boolean } = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState('')

  const isConnectionsPage = pathname === '/connections'

  useEffect(() => {
    if (pathname === '/search' || pathname === '/connections') {
      setSearchQuery(searchParams.get('q') ?? '')
    } else {
      setSearchQuery('')
    }
  }, [pathname, searchParams])
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  // Session 直接從 Context 讀取，不打任何 API
  const session = useSession()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const target = isConnectionsPage ? '/connections' : '/search'
    if (searchQuery.trim()) {
      router.push(`${target}?q=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      router.push(target)
    }
    setMobileSearchOpen(false)
  }

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient()
    // signOut 失敗也不擋導航，避免把使用者困在原頁。
    await supabase.auth.signOut().catch(() => {})
    // 整頁導向：清掉 Router Cache 與 Server 端 session，避免登出後殘留舊帳號狀態。
    window.location.assign('/')
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 md:h-16 md:gap-4 md:px-4">
        {/* Logo */}
        <Link href="/" className="shrink-0">
          <Image src="/logo-navbar.png" alt="Kozukase" width={502} height={177} className="h-7 w-auto md:h-9" priority />
        </Link>

        {/* Desktop Search */}
        <form onSubmit={handleSearch} className="hidden flex-1 md:flex max-w-lg">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isConnectionsPage ? '搜尋連線標題...' : '搜尋商品名稱或品牌...'}
              className="pl-10"
            />
          </div>
        </form>

        {/* Auth Section */}
        <div className="ml-auto flex items-center gap-1 md:gap-2">
          {/* Mobile Search Toggle */}
          <Button
            variant="ghost"
            size="icon-xl"
            className="md:hidden"
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
          >
            <Search className="h-6 w-6" />
          </Button>

          {/* 即時頻道監聽：不分裝置都掛載 */}
          {session?.profile && <UserChannelListener />}

          {/* 桌機才顯示帳號操作；手機全部收進右側漢堡選單 */}
          <div className="hidden items-center gap-1 md:flex md:gap-2">
          {session?.profile ? (
            <>
              <NotificationBell />
              <MessageBell />
              <DropdownMenu>
                <DropdownMenuTrigger
                  nativeButton={false}
                  render={
                    <span className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'relative' })}>
                      <Avatar className="h-7 w-7 md:h-8 md:w-8">
                        <AvatarImage src={session.profile.avatar_url ?? undefined} />
                        <AvatarFallback>{session.profile.display_name?.[0] ?? '?'}</AvatarFallback>
                      </Avatar>
                    </span>
                  }
                >
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem render={<Link href="/notifications" />}>
                    <Bell className="h-4 w-4" />通知
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/account" />}>
                    <Settings className="h-4 w-4" />帳號設定
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/favorites" />}>
                    <Heart className="h-4 w-4" />我的收藏
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {session.isSeller ? (
                    <DropdownMenuItem render={<Link href="/dashboard" />}>
                      <Store className="h-4 w-4" />賣家後台
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem render={<Link href="/become-seller" />}>
                      <Store className="h-4 w-4" />成為賣家
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="h-4 w-4" />登出
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/register"
                className={buttonVariants({
                  variant: 'outline',
                  size: 'sm',
                  className: 'hidden sm:inline-flex',
                })}
              >
                註冊
              </Link>
              <Link href="/login" className={buttonVariants({ size: 'sm' })}>
                登入
              </Link>
            </div>
          )}
          </div>

          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger
              nativeButton={false}
              render={
                <span className={buttonVariants({ variant: 'ghost', size: 'icon-xl', className: 'md:hidden' })}>
                  <Menu className="h-7 w-7" />
                </span>
              }
            />
            <SheetContent side="right" className="w-72">
              <nav className="flex flex-col gap-2 pt-8">
                <Link href="/search" onClick={() => setMobileMenuOpen(false)} className={buttonVariants({ variant: 'ghost', className: 'justify-start' })}>
                  搜尋商品
                </Link>
                <Link href="/search?tab=listings" onClick={() => setMobileMenuOpen(false)} className={buttonVariants({ variant: 'ghost', className: 'justify-start' })}>
                  商品代購
                </Link>
                <Link href="/connections" onClick={() => setMobileMenuOpen(false)} className={buttonVariants({ variant: 'ghost', className: 'justify-start' })}>
                  連線代購
                </Link>
                <Link href="/wishes" onClick={() => setMobileMenuOpen(false)} className={buttonVariants({ variant: 'ghost', className: 'justify-start' })}>
                  許願榜
                </Link>

                {/* 帳號操作（手機從 navbar 收進選單，依登入狀態顯示） */}
                <div className="my-2 border-t" />
                {session?.profile ? (
                  <>
                    <Link href="/notifications" onClick={() => setMobileMenuOpen(false)} className={buttonVariants({ variant: 'ghost', className: 'justify-start' })}>
                      <Bell className="h-4 w-4" />通知
                    </Link>
                    <Link href="/messages" onClick={() => setMobileMenuOpen(false)} className={buttonVariants({ variant: 'ghost', className: 'justify-start' })}>
                      <MessageCircle className="h-4 w-4" />訊息
                    </Link>
                    <Link href="/account" onClick={() => setMobileMenuOpen(false)} className={buttonVariants({ variant: 'ghost', className: 'justify-start' })}>
                      <Settings className="h-4 w-4" />帳號設定
                    </Link>
                    <Link href="/favorites" onClick={() => setMobileMenuOpen(false)} className={buttonVariants({ variant: 'ghost', className: 'justify-start' })}>
                      <Heart className="h-4 w-4" />我的收藏
                    </Link>
                    <Link href={session.isSeller ? '/dashboard' : '/become-seller'} onClick={() => setMobileMenuOpen(false)} className={buttonVariants({ variant: 'ghost', className: 'justify-start' })}>
                      <Store className="h-4 w-4" />{session.isSeller ? '賣家後台' : '成為賣家'}
                    </Link>
                    <button type="button" onClick={() => { setMobileMenuOpen(false); handleLogout() }} className={buttonVariants({ variant: 'ghost', className: 'justify-start' })}>
                      <LogOut className="h-4 w-4" />登出
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setMobileMenuOpen(false)} className={buttonVariants({ className: 'justify-start' })}>
                      登入
                    </Link>
                    <Link href="/register" onClick={() => setMobileMenuOpen(false)} className={buttonVariants({ variant: 'outline', className: 'justify-start' })}>
                      註冊
                    </Link>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop Sub Nav(navbar 下方第二排,靠左對齊 banner) */}
      {/* 訊息頁是滿版聊天介面,不顯示這條次選單(也讓 100vh - 4rem 的高度計算正確) */}
      {showSubNav && pathname !== '/messages' && (
      <nav className="hidden md:block border-t">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5 md:px-4">
          <Link href="/search?tab=listings" className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-3' })}>
            商品代購
          </Link>
          <Link href="/connections" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            連線代購
          </Link>
          <Link href="/wishes" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            許願榜
          </Link>
        </div>
      </nav>
      )}

      {/* Mobile Search Bar */}
      {mobileSearchOpen && (
        <div className="border-t px-3 py-1.5 md:hidden">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isConnectionsPage ? '搜尋連線標題...' : '搜尋商品名稱或品牌...'}
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
