// 網站層級常數。網址以環境變數覆寫，預設正式網域（測試也用此預設）。
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kozukase.com').replace(/\/$/, '')
export const SITE_NAME = 'Kozukase'
export const SITE_TAGLINE = '找代購、比代購'
export const SITE_DESCRIPTION =
  '一站比較各代購賣家的價格、評價與出貨速度，找到值得信任的代購服務'

// Kozukase 官方社群帳號。用於結構化資料的 sameAs 與頁尾連結。
export const SITE_SOCIAL_LINKS = [
  { name: 'Instagram', url: 'https://www.instagram.com/kozukase', icon: '/images/instagram.png' },
  { name: 'Threads', url: 'https://www.threads.net/@kozukase', icon: '/images/threads.png' },
] as const
