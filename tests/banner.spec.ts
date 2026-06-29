import { test, expect } from './fixtures'
import { dbAdmin } from './helpers/db'

// home_banners 欄位(確認真實 schema):image_url/image_r2_key NOT NULL、is_active 預設 true、
// sort_order 預設 0、created_by 可空。
test('有 active banner 時首頁顯示 hero 圖片', async ({ buyerPage }) => {
  const key = `images/banner/e2e-${Date.now()}.jpg`
  const { data: b } = await dbAdmin().from('home_banners').insert({
    image_r2_key: key, image_url: `${process.env.R2_PUBLIC_URL}/${key}`, sort_order: 999, is_active: true,
  }).select('id').single()
  try {
    await buyerPage.goto('/')
    await expect(buyerPage.locator('header')).toBeVisible({ timeout: 15000 })
    await expect(buyerPage.locator('img').first()).toBeVisible({ timeout: 15000 })
  } finally {
    await dbAdmin().from('home_banners').delete().eq('id', b!.id)
  }
})
