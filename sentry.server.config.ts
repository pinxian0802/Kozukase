import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 效能追蹤：10% 請求，避免吃光額度
  tracesSampleRate: 0.1,
})
