import { test as base, expect, Browser, Page } from '@playwright/test'
import { purgeE2EData } from './helpers/cleanup'

async function pageFor(browser: Browser, state: string): Promise<Page> {
  const ctx = await browser.newContext({ storageState: state })
  return ctx.newPage()
}

type Roles = { buyerPage: Page; sellerPage: Page; adminPage: Page }

export const test = base.extend<Roles>({
  buyerPage: async ({ browser }, use) => {
    const p = await pageFor(browser, 'tests/.auth/buyer.json')
    await use(p)
    await p.context().close()
  },
  sellerPage: async ({ browser }, use) => {
    const p = await pageFor(browser, 'tests/.auth/seller.json')
    await use(p)
    await p.context().close()
  },
  adminPage: async ({ browser }, use) => {
    const p = await pageFor(browser, 'tests/.auth/admin.json')
    await use(p)
    await p.context().close()
  },
})

// Every cross-role file purges its own [E2E] data after each test.
test.afterEach(async () => {
  await purgeE2EData()
})

export { expect }
