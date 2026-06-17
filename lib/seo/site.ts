// 網站層級常數。網址以環境變數覆寫，預設正式網域（測試也用此預設）。
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kozukase.com').replace(/\/$/, '')
export const SITE_NAME = 'Kozukase'
export const SITE_TAGLINE = '代購比價平台'
export const SITE_DESCRIPTION =
  '比較各代購賣家的價格、評價、運送速度，找到最適合你的代購服務'
