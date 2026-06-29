import type { Page } from '@playwright/test'
import { dbAdmin } from './db'

// 動態列/卡:data-testid + data-id 同元素。桌機與 mobile 共用同 testid,
// 測試在 Desktop Chrome 跑,first() 取桌機那筆即可。
export function listingRow(page: Page, id: string) {
  return page.locator(`[data-testid="listing-row"][data-id="${id}"]`).first()
}
export function connectionRow(page: Page, id: string) {
  return page.locator(`[data-testid="connection-row"][data-id="${id}"]`).first()
}
export function adminRow(page: Page, id: string) {
  return page.locator(`[data-testid="admin-row"][data-id="${id}"]`).first()
}
export function notificationItem(page: Page, type?: string) {
  const sel = type
    ? `[data-testid="notification-item"][data-type="${type}"]`
    : `[data-testid="notification-item"]`
  return page.locator(sel)
}
export function reviewItem(page: Page, id: string) {
  return page.locator(`[data-testid="review-item"][data-id="${id}"]`).first()
}

// 臨時帳號:用於 become-seller 等需要乾淨帳號的測試。
const TMP_PASSWORD = process.env.E2E_PASSWORD!
export async function createTempUser(): Promise<{ id: string; email: string; password: string }> {
  const email = `e2e-tmp-${crypto.randomUUID()}@kozukase.test`
  const { data, error } = await dbAdmin().auth.admin.createUser({
    email,
    password: TMP_PASSWORD,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`createTempUser failed: ${error?.message}`)
  return { id: data.user.id, email, password: TMP_PASSWORD }
}
export async function deleteTempUser(userId: string): Promise<void> {
  await dbAdmin().from('profiles').delete().eq('id', userId)
  await dbAdmin().auth.admin.deleteUser(userId)
}
