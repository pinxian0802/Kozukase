import * as Sentry from '@sentry/nextjs'

// dev 模式不啟用 Sentry,避免本機開發吃 Sentry 額度跟拖慢啟動
if (process.env.NODE_ENV === 'production') {
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
}

// App Router 導航效能追蹤(production 才有效;dev 時 Sentry 未初始化,函式自動 no-op)
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
