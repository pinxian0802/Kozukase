import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 效能追蹤：10% 請求，避免吃光額度
  tracesSampleRate: 0.1,

  // 一般 session 不主動錄製
  replaysSessionSampleRate: 0,
  // 出錯才回溯錄製，100%
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      // 隱私：遮蔽所有文字與媒體，避免錄到個資 / 密碼 / 輸入內容
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
})

// App Router 導航效能追蹤
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
