import { test, expect } from '@playwright/test'
import { dbAdmin } from './helpers/db'
import { createTempUser, deleteTempUser } from './helpers/locators'
import { trpcMutate } from './helpers/trpc'

// /become-seller 是單一表單,送出鈕強制要求頭貼上傳+簡介+proof,UI e2e 成本高且脆。
// 核心是 mutation seller.becomeSeller + DB(sellers + seller_regions),故用 trpc 驅動;
// 表單頁面渲染由 smoke 覆蓋。
async function seedProfile(id: string) {
  await dbAdmin().from('profiles').upsert({
    id,
    username: `e2e${id.slice(0, 8)}`,
    display_name: '[E2E] tmp',
  })
}

test('呼叫 seller.becomeSeller 後建立 sellers + seller_regions', async ({ page }) => {
  const u = await createTempUser()
  try {
    await seedProfile(u.id)

    // UI 登入臨時帳號(login 支援密碼;email placeholder=your@email.com,
    // 送出鈕「登入」需 exact 以免撞「使用 Google 登入」),取得 auth cookie
    await page.goto('/login')
    await page.getByPlaceholder('your@email.com').fill(u.email)
    await page.getByLabel('密碼').fill(u.password)
    await page.getByRole('button', { name: '登入', exact: true }).click()
    await expect(page).not.toHaveURL(/login/, { timeout: 20000 })

    // 取一個真實 region id
    const { data: region } = await dbAdmin().from('regions').select('id').limit(1).single()

    // trpc 驅動核心 mutation(用 page 登入後的 cookie)
    await trpcMutate(page.request, 'seller.becomeSeller', {
      name: '[E2E] 測試賣家',
      region_ids: [region!.id],
      can_provide_proof: false,
    })

    // sellers 建立
    await expect
      .poll(async () => {
        const { count } = await dbAdmin()
          .from('sellers').select('id', { count: 'exact', head: true }).eq('id', u.id)
        return count ?? 0
      }, { timeout: 20000 })
      .toBe(1)

    // seller_regions 建立(該 region)
    const { count: regionCount } = await dbAdmin()
      .from('seller_regions').select('seller_id', { count: 'exact', head: true })
      .eq('seller_id', u.id).eq('region_id', region!.id)
    expect(regionCount ?? 0).toBe(1)
  } finally {
    await dbAdmin().from('seller_regions').delete().eq('seller_id', u.id)
    await dbAdmin().from('sellers').delete().eq('id', u.id)
    await deleteTempUser(u.id)
  }
})
