import { test, expect } from './fixtures'
import { getUserIdByEmail, dbAdmin, seedActiveListing } from './helpers/db'

test('買家主旅程:搜尋→代購詳情→詢問→送訊息(帶 context 寫入 DB)', async ({ buyerPage }) => {
  const seed = await seedActiveListing(process.env.E2E_SELLER_EMAIL!)
  try {
    // 1. 搜尋找到 seed 商品(桌機/手機兩套版面都會渲染,用 visible 過濾鎖定顯示的那份)
    await buyerPage.goto(`/search?tab=products&q=${encodeURIComponent(seed.productName)}`)
    await expect(buyerPage.getByText(seed.productName).filter({ visible: true }).first()).toBeVisible({ timeout: 20000 })

    // 2. 進代購詳情頁
    await buyerPage.goto(`/listings/${seed.listingId}`)
    await expect(buyerPage.locator('main, [role="main"]')).toBeVisible({ timeout: 20000 })

    // 3. 按「詢問」開啟訊息(詢問是 <Link> 不是 button,導向 /messages?...&context_type=listing&context_id=<id>)
    await buyerPage.getByRole('link', { name: /詢問/ }).first().click()
    const input = buyerPage.getByPlaceholder(/輸入訊息/)
    await expect(input).toBeVisible({ timeout: 20000 })

    // 4. 送訊息
    const body = `[E2E] 詢問 ${Date.now()}`
    await input.fill(body)
    await buyerPage.keyboard.press('Enter')
    await expect(buyerPage.getByText(body)).toBeVisible({ timeout: 15000 })

    // 5. DB 驗證:訊息存在且帶 listing context
    await expect
      .poll(async () => {
        const { data } = await dbAdmin()
          .from('messages')
          .select('context_type, context_id')
          .eq('body', body)
          .maybeSingle()
        return data ? `${data.context_type}/${data.context_id}` : null
      }, { timeout: 15000 })
      .toBe(`listing/${seed.listingId}`)

    await dbAdmin().from('messages').delete().eq('body', body)
  } finally {
    await dbAdmin().from('products').delete().eq('id', seed.productId)
  }
})

test('買家對賣家發訊息，訊息寫入 DB 並顯示', async ({ buyerPage }) => {
  const sellerId = await getUserIdByEmail(process.env.E2E_SELLER_EMAIL!)
  await buyerPage.goto(`/messages?seller_id=${sellerId}`)
  await buyerPage.waitForLoadState('networkidle')

  const input = buyerPage.getByPlaceholder(/輸入訊息/)
  // The input only mounts after getOrCreate resolves the conversation; retry once.
  try {
    await expect(input).toBeVisible({ timeout: 20000 })
  } catch {
    await buyerPage.goto(`/messages?seller_id=${sellerId}`)
    await buyerPage.waitForLoadState('networkidle')
    await expect(input).toBeVisible({ timeout: 20000 })
  }

  const body = `[E2E] hello ${Date.now()}`
  await input.fill(body)
  await buyerPage.keyboard.press('Enter')

  await expect(buyerPage.getByText(body)).toBeVisible({ timeout: 15000 })
  await expect
    .poll(async () => {
      const { count } = await dbAdmin()
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('body', body)
      return count ?? 0
    }, { timeout: 15000 })
    .toBeGreaterThan(0)

  await dbAdmin().from('messages').delete().eq('body', body)
})

test('賣家可開啟訊息頁', async ({ sellerPage }) => {
  await sellerPage.goto('/messages')
  await expect(sellerPage.locator('main, [role="main"]')).toBeVisible({ timeout: 20000 })
})

// ────────────────────────────────────────────────────────────
// Realtime Broadcast 行為驗證
// ────────────────────────────────────────────────────────────
// 訊息系統從 postgres_changes 切換到 broadcast 後,真正要驗的是:
// 「對方端不刷新、就能即時收到訊息與列表更新」。
// 以下兩個 cross-context 測試模擬買家、賣家分別在兩個瀏覽器,
// 觀察賣家在不重整的情況下是否即時看到買家送的訊息。
// 失敗通常表示:後端沒廣播、頻道權限不放行、或客戶端沒 private: true。

test('即時收訊(廣播):對方開著對話視窗,新訊息不需重整就出現', async ({ buyerPage, sellerPage }) => {
  const sellerId = await getUserIdByEmail(process.env.E2E_SELLER_EMAIL!)

  // 1. 買家進入對話、送出第一則訊息,讓對話建立並排到賣家清單最上方
  await buyerPage.goto(`/messages?seller_id=${sellerId}`)
  const buyerInput = buyerPage.getByPlaceholder(/輸入訊息/)
  await expect(buyerInput).toBeVisible({ timeout: 20000 })

  const initialMsg = `[E2E] 初始 ${Date.now()}`
  await buyerInput.fill(initialMsg)
  await buyerPage.keyboard.press('Enter')
  await expect(buyerPage.getByText(initialMsg)).toBeVisible({ timeout: 15000 })

  // 2. 賣家進 /messages,點開那個對話
  await sellerPage.goto('/messages')
  const convRow = sellerPage.locator('aside button').filter({ hasText: initialMsg })
  await expect(convRow).toBeVisible({ timeout: 15000 })
  await convRow.click()
  await expect(sellerPage.getByPlaceholder(/輸入訊息/)).toBeVisible({ timeout: 10000 })

  // 等賣家端 broadcast 訂閱就緒(private 頻道授權握手需時間);
  // broadcast 是 fire-and-forget 不補發,若買家在 SUBSCRIBED 前送出會被漏接
  await sellerPage.waitForTimeout(3000)

  // 3. 買家送出新訊息;賣家視窗應在不刷新的情況下顯示
  const liveMsg = `[E2E] 即時 ${Date.now()}`
  await buyerInput.fill(liveMsg)
  await buyerPage.keyboard.press('Enter')

  await expect(sellerPage.getByText(liveMsg)).toBeVisible({ timeout: 15000 })
})

test('即時對話列表(廣播):對方在訊息頁但沒開該對話,預覽即時刷新', async ({ buyerPage, sellerPage }) => {
  const sellerId = await getUserIdByEmail(process.env.E2E_SELLER_EMAIL!)

  // 1. 買家建立對話並送初始訊息
  await buyerPage.goto(`/messages?seller_id=${sellerId}`)
  const buyerInput = buyerPage.getByPlaceholder(/輸入訊息/)
  await expect(buyerInput).toBeVisible({ timeout: 20000 })

  const initialMsg = `[E2E] 初始列表 ${Date.now()}`
  await buyerInput.fill(initialMsg)
  await buyerPage.keyboard.press('Enter')
  await expect(buyerPage.getByText(initialMsg)).toBeVisible({ timeout: 15000 })

  // 2. 賣家進 /messages 但不點開對話
  await sellerPage.goto('/messages')
  const list = sellerPage.locator('aside')
  await expect(list.getByText(initialMsg)).toBeVisible({ timeout: 15000 })

  // 等賣家端訂閱就緒再送,避免廣播在 SUBSCRIBED 前發出被漏接
  await sellerPage.waitForTimeout(3000)

  // 3. 買家送新訊息,賣家清單預覽應自動更新
  const newMsg = `[E2E] 新訊息列表 ${Date.now()}`
  await buyerInput.fill(newMsg)
  await buyerPage.keyboard.press('Enter')

  await expect(list.getByText(newMsg)).toBeVisible({ timeout: 15000 })
})
