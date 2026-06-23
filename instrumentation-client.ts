import * as Sentry from '@sentry/nextjs'

// 只有 Vercel 正式 production 才啟用 Sentry。
// dev(本機)與 preview(預覽部署)都不送,避免吃額度跟拖慢啟動。
if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'production') {
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
