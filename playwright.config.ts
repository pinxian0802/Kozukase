import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import fs from 'fs'

// Load .env.local
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
  retries: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30000,
  },
  projects: [
    // Single setup project (all three logins) so the cleanup teardown runs
    // exactly once, at the very end — never mid-suite.
    { name: 'setup', testMatch: /setup\/.+\.setup\.ts/, teardown: 'cleanup' },
    { name: 'cleanup', testMatch: /global\.teardown\.ts/ },
    {
      name: 'buyer',
      testMatch: /buyer\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'tests/.auth/buyer.json' },
      dependencies: ['setup'],
    },
    {
      name: 'seller',
      testMatch: /seller\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'tests/.auth/seller.json' },
      dependencies: ['setup'],
    },
    {
      name: 'cross-role',
      testMatch: /(cross-role|messages|report-takedown|threads-verification|admin-reports|admin-listings|admin-connections|seller-create|seo)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    // auth runs LAST: its logout test calls supabase signOut (global scope),
    // which would revoke the shared buyer account for any project after it.
    {
      name: 'auth',
      testMatch: /auth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'tests/.auth/buyer.json' },
      dependencies: ['setup', 'buyer', 'seller', 'cross-role'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
})
