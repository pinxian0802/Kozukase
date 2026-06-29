import { test, expect } from './fixtures'
import { getUserIdByEmail, dbAdmin } from './helpers/db'
import { e2eName } from './helpers/naming'

test('公開許願榜列出 seed 許願,點進詳情頁', async ({ buyerPage }) => {
  const buyerId = await getUserIdByEmail(process.env.E2E_BUYER_EMAIL!)
  const name = e2eName('許願商品')
  const { data: prod } = await dbAdmin().from('products').insert({ name, category: 'other', created_by: buyerId }).select('id').single()
  // wishes.content 為 NOT NULL,seed 必帶 content
  const { data: wish } = await dbAdmin().from('wishes').insert({ product_id: prod!.id, user_id: buyerId, content: '[E2E] 想要這個' }).select('id').single()
  try {
    await buyerPage.goto('/wishes')
    await expect(buyerPage.getByText(name).first()).toBeVisible({ timeout: 20000 })
    await buyerPage.goto(`/wishes/${wish!.id}`)
    await expect(buyerPage.getByText(name).first()).toBeVisible({ timeout: 20000 })
  } finally {
    await dbAdmin().from('wishes').delete().eq('id', wish!.id)
    await dbAdmin().from('products').delete().eq('id', prod!.id)
  }
})
