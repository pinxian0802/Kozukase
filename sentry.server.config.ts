import * as Sentry from '@sentry/nextjs'

// dev 模式不啟用 Sentry,避免本機開發吃 Sentry 額度跟拖慢啟動
if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // 效能追蹤：10% 請求，避免吃光額度
    tracesSampleRate: 0.1,
  })
}
