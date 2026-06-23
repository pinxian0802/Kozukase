import * as Sentry from '@sentry/nextjs'

// 只有 Vercel 正式 production 才啟用 Sentry。
// dev(本機)與 preview(預覽部署)都不送,避免吃額度跟拖慢啟動。
if (process.env.VERCEL_ENV === 'production') {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // 效能追蹤：10% 請求，避免吃光額度
    tracesSampleRate: 0.1,
  })
}
