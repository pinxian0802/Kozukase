'use client'

import type { ReactNode } from 'react'

export const SUPPORT_EMAIL = 'support@kozukase.com'

export function MailLink() {
  return (
    <a
      href={`mailto:${SUPPORT_EMAIL}`}
      className="text-brand-700 underline"
      onClick={(e) => e.stopPropagation()}
    >
      {SUPPORT_EMAIL}
    </a>
  )
}

// 由 type + payload 組出「標題 + 內文」。標題動態帶名稱；payload 無名稱（改動前的舊通知）時 fallback 成通用標題。
export function getNotificationContent(
  type: string,
  payload: Record<string, unknown> | null,
): { title: string; body: ReactNode | null } {
  const p = payload ?? {}
  const productName = typeof p.product_name === 'string' ? p.product_name : null
  const connectionName = typeof p.connection_title === 'string' ? p.connection_title : null
  const reason =
    typeof p.admin_note === 'string' ? p.admin_note
    : typeof p.reason === 'string' ? p.reason
    : null
  const rating = typeof p.rating === 'number' ? p.rating : null
  const threadsUsername = typeof p.threads_username === 'string' ? p.threads_username : null
  const igUsername = typeof p.ig_username === 'string' ? p.ig_username : null

  switch (type) {
    case 'connection_removed_by_admin':
      return {
        title: connectionName ? `「${connectionName}」已被中止` : '代購連線已被中止',
        body: (
          <>
            {reason ? `因「${reason}」，` : ''}此代購連線已被中止。改善後可重新發佈，如有任何問題請來信 <MailLink />。
          </>
        ),
      }
    case 'connection_republish_approved':
      return {
        title: connectionName ? `「${connectionName}」已重新發佈` : '代購連線已重新發佈',
        body: '你的重新申請已通過審核，此代購連線已重新公開於平台。',
      }
    case 'listing_removed_by_admin':
      return {
        title: productName ? `「${productName}」代購已被下架` : '代購已被下架',
        body: (
          <>
            {reason ? `因「${reason}」，` : ''}此代購已被下架。修正後可至賣家後台重新送出審核，如有疑問請來信 <MailLink />。
          </>
        ),
      }
    case 'listing_republish_approved':
      return {
        title: productName ? `「${productName}」代購已重新上架` : '代購已重新上架',
        body: '你的重新上架申請已通過審核，代購已重新公開於平台。',
      }
    case 'product_removed':
      return {
        title: productName ? `「${productName}」已被移除，相關代購已下架` : '相關商品已被移除，代購已下架',
        body: `商品${productName ? `「${productName}」` : ''}已從平台移除，你針對此商品的代購已自動下架。可在編輯頁改選其他有效商品後重新送出審核。`,
      }
    case 'account_action_taken':
      return {
        title: '你的帳號已被停權',
        body: (
          <>
            {reason ? `因「${reason}」，` : ''}你的帳號已被停權，名下代購與連線已暫停。如有疑問請來信 <MailLink />。
          </>
        ),
      }
    case 'review_received':
      return {
        title: rating ? `你收到一則新評價（${rating} 星）` : '你收到一則新評價',
        body: rating
          ? `有買家給了你 ${rating} 星評價，點擊查看並回覆。`
          : '有買家給了你新評價，點擊查看並回覆。',
      }
    case 'threads_verification_approved':
      return {
        title: 'Threads 帳號驗證已通過',
        body: threadsUsername
          ? `你的 Threads 帳號「@${threadsUsername}」已通過驗證，賣家頁將顯示驗證標章。`
          : '你的 Threads 帳號已通過驗證，賣家頁將顯示驗證標章。',
      }
    case 'threads_verification_rejected':
      return {
        title: 'Threads 帳號驗證未通過',
        body: (
          <>
            {reason ? `因「${reason}」，` : ''}你的 Threads 帳號{threadsUsername ? `「@${threadsUsername}」` : ''}驗證未通過，請確認後重新申請，如有疑問請來信 <MailLink />。
          </>
        ),
      }
    case 'ig_verification_approved':
      return {
        title: 'Instagram 帳號驗證已通過',
        body: igUsername
          ? `你的 Instagram 帳號「@${igUsername}」已通過驗證，賣家頁將顯示驗證標章。`
          : '你的 Instagram 帳號已通過驗證，賣家頁將顯示驗證標章。',
      }
    case 'ig_verification_rejected':
      return {
        title: 'Instagram 帳號驗證未通過',
        body: (
          <>
            {reason ? `因「${reason}」，` : ''}你的 Instagram 帳號{igUsername ? `「@${igUsername}」` : ''}驗證未通過，請確認後重新申請，如有疑問請來信 <MailLink />。
          </>
        ),
      }
    case 'new_listing_for_wish':
      return {
        title: productName ? `「${productName}」有新代購上架` : '許願商品有新上架',
        body: '你許願的商品有賣家新上架代購，快來看看。',
      }
    default:
      return { title: type, body: null }
  }
}
