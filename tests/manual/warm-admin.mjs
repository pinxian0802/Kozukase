// One-off: log in as the E2E admin and hit the heavy authenticated admin pages
// so the persistent webpack-dev server compiles them BEFORE the timed setup runs.
//   node tests/manual/warm-admin.mjs
import { chromium } from '@playwright/test'
import { readFileSync } from 'fs'

const env = {}
for (const line of readFileSync('.env.local', 'utf-8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i === -1) continue
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
}

const BASE = 'http://localhost:3000'
const browser = await chromium.launch()
const page = await browser.newPage()

await page.goto(`${BASE}/login`)
await page.locator('#email').fill(env.E2E_ADMIN_EMAIL)
await page.locator('#password').fill(env.E2E_PASSWORD)
await page.getByRole('button', { name: '登入', exact: true }).click()
await page.waitForURL(
  (u) => !u.pathname.includes('/login') && !u.pathname.includes('/onboarding'),
  { timeout: 60000 },
)
console.log('logged in as admin')

for (const route of ['/admin', '/admin/today', '/admin/listings', '/admin/reports']) {
  const t = Date.now()
  await page.goto(`${BASE}${route}`, { waitUntil: 'commit', timeout: 200000 })
  console.log(`warmed ${route} in ${((Date.now() - t) / 1000).toFixed(1)}s -> ${page.url()}`)
}

await browser.close()
console.log('DONE')
