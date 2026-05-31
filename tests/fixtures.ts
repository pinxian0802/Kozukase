import { test as base, expect, Browser, Page, TestInfo } from '@playwright/test'
import { purgeE2EData } from './helpers/cleanup'

async function pageFor(browser: Browser, state: string): Promise<Page> {
  const ctx = await browser.newContext({ storageState: state, recordVideo: { dir: 'test-results/' } })
  return ctx.newPage()
}

async function closeWithVideo(p: Page, testInfo: TestInfo) {
  const video = p.video()
  await p.context().close()
  if (video) {
    const videoPath = await video.path()
    await testInfo.attach('video', { path: videoPath, contentType: 'video/webm' })
  }
}

type Roles = { buyerPage: Page; sellerPage: Page; adminPage: Page }

export const test = base.extend<Roles>({
  buyerPage: async ({ browser }, use, testInfo) => {
    const p = await pageFor(browser, 'tests/.auth/buyer.json')
    await use(p)
    await closeWithVideo(p, testInfo)
  },
  sellerPage: async ({ browser }, use, testInfo) => {
    const p = await pageFor(browser, 'tests/.auth/seller.json')
    await use(p)
    await closeWithVideo(p, testInfo)
  },
  adminPage: async ({ browser }, use, testInfo) => {
    const p = await pageFor(browser, 'tests/.auth/admin.json')
    await use(p)
    await closeWithVideo(p, testInfo)
  },
})

// Every cross-role file purges its own [E2E] data after each test.
test.afterEach(async () => {
  await purgeE2EData()
})

export { expect }
