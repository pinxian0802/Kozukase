import path from 'path'
import { test, expect } from './fixtures'
import { dbAdmin } from './helpers/db'
import { e2eName } from './helpers/naming'

const TEST_IMAGE = path.resolve(__dirname, 'assets', '測試圖片.png')

// 選擇 DatePicker — 導到下個月再用日期數字選（避免 showOutsideDays 干擾）
async function pickDate(page: import('@playwright/test').Page, triggerName: string, day: number) {
  await page.getByRole('button', { name: triggerName }).click()
  // 多個 date picker 時舊 popover 可能未卸載,用 .last() 取剛開的那個日曆
  const calendar = page.locator('[data-slot="calendar"]').last()
  await expect(calendar).toBeVisible({ timeout: 5000 })
  await calendar.locator('[class*="rdp-button_next"]').first().click()
  // 日曆可能顯示多月份,同一天數字出現多次;測試不在意確切日期,取第一個可見的
  await calendar.locator('[data-day]').getByText(String(day), { exact: true }).first().click()
}

// 連線日期是「範圍選擇器」(DateRangePicker):單一 trigger(空白時文字含「選擇開始日期」),
// 點開後在同一個 2 月份日曆裡先點起日、再點訖日(numberOfMonths=2,每天數字出現多次取第一個=左月)。
async function pickDateRange(page: import('@playwright/test').Page, startDay: number, endDay: number) {
  await page.getByRole('button', { name: /選擇開始日期/ }).click()
  const calendar = page.locator('[data-slot="calendar"]').last()
  await expect(calendar).toBeVisible({ timeout: 5000 })
  await calendar.locator('[class*="rdp-button_next"]').first().click()
  await calendar.locator('[data-day]').getByText(String(startDay), { exact: true }).first().click()
  await calendar.locator('[data-day]').getByText(String(endDay), { exact: true }).first().click()
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. 賣家新增代購（同時新增商品）→ listing 直接上架，商品也被建立
// ─────────────────────────────────────────────────────────────────────────────
test('賣家透過 UI 新增代購（含新增商品）→ 直接上架為 active', async ({ sellerPage }) => {
  const productName = e2eName('商品')
  const listingTitle = e2eName('代購')
  // 品牌名每次唯一:固定名稱會在第一次跑後就存在,導致之後下拉只顯示既有品牌、
  // 不再出現「新增品牌」選項 → 點擊 timeout(測試資料污染)。
  const brandName = e2eName('品牌')

  await sellerPage.goto('/dashboard/listings/new')
  await sellerPage.waitForTimeout(1000)

  // ── 搜尋 → 點「沒有我的商品」直接進代購表單 ──
  await sellerPage.getByPlaceholder('搜尋商品名稱...').fill(productName)
  await sellerPage.waitForTimeout(1000)
  await sellerPage.getByRole('button', { name: '沒有我的商品' }).click()

  // ── 單一代購表單 ──
  await expect(sellerPage.getByPlaceholder('輸入代購標題')).toBeVisible({ timeout: 15000 })
  // 代購標題（必填）
  await sellerPage.getByPlaceholder('輸入代購標題').fill(listingTitle)
  // 代購圖片（必填，整頁唯一的上傳處）
  await sellerPage.locator('input[type="file"]').setInputFiles(TEST_IMAGE)
  await sellerPage.waitForTimeout(1000)
  // 價格（必填）
  await sellerPage.getByPlaceholder('輸入價格').fill('888')

  // ── 商品資訊（位於價格與規格之間）──
  // 商品名稱（必填，已由搜尋預填，再次確認）
  await sellerPage.getByPlaceholder('輸入商品名稱').fill(productName)
  // 品牌（選填，即時新增）
  await sellerPage.getByRole('button', { name: /選擇.*品牌/ }).click()
  await sellerPage.getByPlaceholder('搜尋或輸入品牌名稱...').fill(brandName)
  await sellerPage.waitForTimeout(500)
  await sellerPage.getByRole('option', { name: /新增品牌/ }).click()
  await sellerPage.waitForTimeout(500)
  // 型號（選填）
  await sellerPage.getByPlaceholder('輸入型號').fill('E2E-001')
  // 分類（選填）
  await sellerPage.getByRole('combobox').click()
  await sellerPage.getByRole('option', { name: '美妝保養' }).click()
  // 商品國家（選填）
  await sellerPage.getByRole('button', { name: '選擇國家' }).click()
  await sellerPage.getByRole('option').first().click()

  // ── 出貨/連結/說明 ──(順序對齊手動:先貼文連結、再說明,最後等 10 秒)
  await pickDate(sellerPage, '選擇預計出貨日期', 25)
  await sellerPage.getByPlaceholder(/instagram/).fill('https://www.instagram.com/p/e2e-test')
  await sellerPage.getByPlaceholder('補充說明...').fill('[E2E] 測試代購說明')
  // 等待非同步處理（圖片壓縮、URL 安全檢查）
  await sellerPage.waitForTimeout(10000)
  await sellerPage.getByRole('button', { name: '直接上架' }).click()

  // ── 驗證：代購已上架並可被搜尋到 ──
  await sellerPage.waitForURL('**/dashboard/listings', { timeout: 30000 })
  // 搜尋商品分頁比對的是「商品名稱」;搜尋剛建立的商品(有 active 代購故可被搜到),
  // RWD 兩套版面用 visible 過濾鎖定顯示的那份
  await sellerPage.goto(`/search?tab=products&q=${encodeURIComponent(productName)}`)
  await expect(sellerPage.getByText(productName).filter({ visible: true }).first()).toBeVisible({ timeout: 20000 })

  // ── 驗證：商品已建立且有代表圖（catalog_image_id 已回填）──
  await expect
    .poll(
      async () => {
        const { data } = await dbAdmin()
          .from('products')
          .select('catalog_image_id')
          .like('name', `${productName}%`)
          .maybeSingle()
        return data?.catalog_image_id
      },
      { timeout: 20000 },
    )
    .not.toBeNull()
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. 賣家新增連線 → 直接上架為 active
// ─────────────────────────────────────────────────────────────────────────────
test('賣家透過 UI 新增連線 → 直接上架為 active', async ({ sellerPage }) => {
  const title = e2eName('連線')
  let connectionId: string | null = null

  await sellerPage.goto('/dashboard/connections/new')
  await expect(sellerPage.getByRole('heading', { name: '新增連線公告' })).toBeVisible({ timeout: 15000 })

  await sellerPage.getByPlaceholder('輸入連線標題').fill(title)
  // 連線圖片（必填，至少 1 張）
  await sellerPage.locator('input[type="file"]').setInputFiles(TEST_IMAGE)
  await sellerPage.waitForTimeout(1000)

  await sellerPage.getByRole('button', { name: '選擇國家' }).click()
  await sellerPage.getByRole('option').first().click()

  // 連線日期=範圍選擇器(同一日曆選起訖);出貨日期=獨立單日 picker
  await pickDateRange(sellerPage, 5, 15)
  await pickDate(sellerPage, '選擇預計出貨日期', 25)

  await sellerPage.getByPlaceholder('補充連線行程說明...').fill('[E2E] 測試連線說明，採購藥妝與限定商品。')
  await sellerPage.getByPlaceholder('說明收費方式、付款方式...').fill('[E2E] 商品售價 + 代購服務費 10%')

  // 等待圖片壓縮/上傳前處理完成再送出
  await sellerPage.waitForTimeout(10000)
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
