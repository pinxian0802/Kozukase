import path from 'path'
import { test, expect } from './fixtures'
import { dbAdmin } from './helpers/db'
import { e2eName } from './helpers/naming'

const TEST_IMAGE = path.resolve(__dirname, 'assets', '測試圖片.png')

// 選擇 DatePicker — 導到下個月再用日期數字選（避免 showOutsideDays 干擾）
async function pickDate(page: import('@playwright/test').Page, triggerName: string, day: number) {
  await page.getByRole('button', { name: triggerName }).click()
  const calendar = page.locator('[data-slot="calendar"]').first()
  await expect(calendar).toBeVisible({ timeout: 5000 })
  await calendar.locator('[class*="rdp-button_next"]').first().click()
  await calendar.locator('[data-day]').getByText(String(day), { exact: true }).click()
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. 賣家新增代購（同時新增商品）→ listing 直接上架，商品也被建立
// ─────────────────────────────────────────────────────────────────────────────
test('賣家透過 UI 新增代購（含新增商品）→ 直接上架為 active', async ({ sellerPage }) => {
  const productName = e2eName('商品')
  const listingTitle = e2eName('代購')

  await sellerPage.goto('/dashboard/listings/new')
  await sellerPage.waitForTimeout(1000)

  // ── Step 1：搜尋框輸入商品名，點「新增商品」──
  await sellerPage.getByPlaceholder('搜尋商品名稱...').fill(productName)
  await sellerPage.waitForTimeout(1000)
  await sellerPage.getByText(`新增商品「${productName}」`).click()
  await sellerPage.waitForTimeout(1000)

  // ── Step 2：商品表單 ──
  await expect(sellerPage.getByPlaceholder('輸入商品名稱')).toBeVisible({ timeout: 10000 })
  // 圖片（必填）
  await sellerPage.locator('input[type="file"]').setInputFiles(TEST_IMAGE)
  await sellerPage.waitForTimeout(1000)
  // 商品名稱（必填，已由搜尋預填，再次確認）
  await sellerPage.getByPlaceholder('輸入商品名稱').fill(productName)
  await sellerPage.waitForTimeout(1000)
  // 品牌（選填）
  await sellerPage.getByRole('button', { name: /選擇.*品牌/ }).click()
  await sellerPage.getByPlaceholder('搜尋或輸入品牌名稱...').fill('[E2E] 品牌')
  await sellerPage.waitForTimeout(500)
  await sellerPage.getByRole('option', { name: /新增品牌/ }).click()
  await sellerPage.waitForTimeout(1000)
  // 型號（選填）
  await sellerPage.getByPlaceholder('輸入型號').fill('E2E-001')
  await sellerPage.waitForTimeout(1000)
  // 分類（選填）
  await sellerPage.getByRole('combobox').click()
  await sellerPage.getByRole('option', { name: '美妝保養' }).click()
  await sellerPage.waitForTimeout(1000)
  // 商品國家（選填）
  await sellerPage.getByRole('button', { name: '選擇國家' }).click()
  await sellerPage.getByRole('option').first().click()
  await sellerPage.waitForTimeout(1000)
  await sellerPage.getByRole('button', { name: '下一步' }).click()
  await sellerPage.waitForTimeout(1000)

  // ── Step 3：填寫代購資料 ──
  await expect(sellerPage.getByPlaceholder('輸入標題')).toBeVisible({ timeout: 15000 })
  // 標題（必填）
  await sellerPage.getByPlaceholder('輸入標題').fill(listingTitle)
  await sellerPage.waitForTimeout(1000)
  // 代購圖片（必填，至少一張）
  await sellerPage.locator('input[type="file"]').setInputFiles(TEST_IMAGE)
  await sellerPage.waitForTimeout(1000)
  // 價格（必填）
  await sellerPage.getByPlaceholder('輸入價格').fill('888')
  await sellerPage.waitForTimeout(1000)
  // 預計出貨日期（必填）
  await pickDate(sellerPage, '選擇預計出貨日期', 25)
  await sellerPage.waitForTimeout(1000)
  // 說明（選填）
  await sellerPage.getByPlaceholder('補充說明...').fill('[E2E] 測試代購說明')
  await sellerPage.waitForTimeout(1000)
  // 貼文連結（必填）
  await sellerPage.getByPlaceholder(/instagram/).fill('https://www.instagram.com/p/e2e-test')
  // 等待所有非同步處理完成（圖片壓縮、URL 安全檢查等）
  await sellerPage.waitForTimeout(10000)
  await sellerPage.getByRole('button', { name: '直接上架' }).click()

  // ── 驗證：等待重導向後前往搜尋頁確認代購已出現 ──
  await sellerPage.waitForURL('**/dashboard/listings', { timeout: 30000 })
  await sellerPage.goto(`/search?q=${encodeURIComponent(listingTitle)}`)
  await expect(sellerPage.getByText(listingTitle)).toBeVisible({ timeout: 20000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. 賣家新增連線 → 直接上架為 active
// ─────────────────────────────────────────────────────────────────────────────
test('賣家透過 UI 新增連線 → 直接上架為 active', async ({ sellerPage }) => {
  const title = e2eName('連線')
  let connectionId: string | null = null

  await sellerPage.goto('/dashboard/connections/new')
  await expect(sellerPage.getByRole('heading', { name: '新增連線公告' })).toBeVisible({ timeout: 15000 })

  await sellerPage.getByPlaceholder('輸入標題').fill(title)

  await sellerPage.getByRole('button', { name: '選擇國家' }).click()
  await sellerPage.getByRole('option').first().click()

  // 選日期：導到下個月再點固定日期，避免 showOutsideDays 選到上個月的日期
  await pickDate(sellerPage, '選擇開始日期', 5)
  await pickDate(sellerPage, '選擇結束日期', 15)
  await pickDate(sellerPage, '選擇預計出貨日期', 25)

  await sellerPage.getByPlaceholder('補充連線行程說明...').fill('[E2E] 測試連線說明，採購藥妝與限定商品。')
  await sellerPage.getByPlaceholder('說明收費方式、付款方式...').fill('[E2E] 商品售價 + 代購服務費 10%')

  await sellerPage.getByRole('button', { name: '建立連線公告' }).click()

  await expect
    .poll(
      async () => {
        const { data } = await dbAdmin()
          .from('connections')
          .select('id, status')
          .like('title', `${title}%`)
          .maybeSingle()
        connectionId = data?.id ?? null
        return data?.status
      },
      { timeout: 20000 },
    )
    .toBe('active')

  if (connectionId) {
    await dbAdmin().from('connections').delete().eq('id', connectionId)
  }
})
