import { getServerSession } from '@/lib/supabase/get-session'
import { refreshSocialTokens } from '@/lib/utils/social-tokens'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession()

  // 賣家進入後台時靜默刷新 social tokens（fire-and-forget，不阻塞頁面渲染）
  if (session?.isSeller) {
    refreshSocialTokens(session.user.id).catch((err) => {
      console.error('[DashboardLayout] refreshSocialTokens error:', err)
    })
  }

  return <>{children}</>
}
