// 暫用設定:只跑「賣家」登入 + Threads 流程測試,產生含錄影的 HTML 報告。驗證完即可刪除。
import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const envPath = path.resolve(__dirname, '.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  expect: { timeout: 30000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:3000',
    actionTimeout: 30000,
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },
  projects: [
    { name: 'seller-setup', testMatch: /setup\/seller\.setup\.ts/ },
    {
      name: 'threads',
      testMatch: /threads-verification\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['seller-setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
})
