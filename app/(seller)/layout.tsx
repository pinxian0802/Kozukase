import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/supabase/get-session'
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar'

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  // getServerSession() 使用 React cache()，與 root layout 共用同一次 DB 查詢
  const session = await getServerSession()

  if (!session) {
    redirect('/login?next=/dashboard')
  }

  if (!session.isSeller) {
    redirect('/become-seller')
  }

  const sellerProfile = session.profile.sellers as Record<string, unknown> | null
  const sellerName = typeof sellerProfile?.name === 'string' && sellerProfile.name.trim()
    ? sellerProfile.name
    : session.profile.display_name ?? '賣家'
  const sellerUsername = typeof session.profile.username === 'string' && session.profile.username.trim()
    ? session.profile.username
    : '未設定 username'
  const sellerAvatarUrl = typeof sellerProfile?.avatar_url === 'string' && sellerProfile.avatar_url.trim()
    ? sellerProfile.avatar_url
    : null

  return (
    <>
      <Header />
      <div className="flex flex-1">
        <Sidebar
          mode="seller"
          sellerProfile={{
            username: sellerUsername,
            name: sellerName,
            avatarUrl: sellerAvatarUrl,
          }}
        />
        <main className="min-w-0 flex-1 px-3 py-3 bg-white pb-[calc(5rem+env(safe-area-inset-bottom))] max-md:overflow-x-clip md:p-6 md:pb-6">{children}</main>
      </div>
    </>
  )
}
