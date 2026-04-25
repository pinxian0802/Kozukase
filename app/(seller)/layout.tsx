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

  return (
    <>
      <Header />
      <div className="flex flex-1">
        <Sidebar mode="seller" />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </>
  )
}
