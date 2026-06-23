import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

// 只有需要登入才能進入的路徑才跑 proxy。
// 公開頁面(首頁、商品頁、賣家頁、搜尋等)完全跳過,跳頁速度大幅提升。
// 登入身分由各頁面 / API 透過 cookie 各自判斷(tRPC ctx、root layout 的 getServerSession),
// 不依賴 proxy。
export const config = {
  matcher: [
    '/favorites/:path*',
    '/account/:path*',
    '/become-seller/:path*',
    '/messages/:path*',
    '/notifications/:path*',
    '/dashboard/:path*',
    '/admin/:path*',
    '/onboarding/:path*',
  ],
}
