import { test, expect } from './fixtures'

// 集中所有「頁面能渲染」的淺檢查;深測在各自 spec。
const buyerPaths = ['/', '/search', '/connections', '/wishes', '/favorites', '/notifications', '/messages', '/account']

for (const path of buyerPaths) {
  test(`買家頁面渲染: ${path}`, async ({ buyerPage }) => {
    await buyerPage.goto(path)
    await expect(buyerPage.locator('header')).toBeVisible({ timeout: 15000 })
    await expect(buyerPage.locator('main, [role="main"]')).toBeVisible({ timeout: 15000 })
  })
}

const sellerPaths = ['/dashboard', '/dashboard/listings', '/dashboard/connections', '/dashboard/profile']
for (const path of sellerPaths) {
  test(`賣家頁面渲染: ${path}`, async ({ sellerPage }) => {
    await sellerPage.goto(path)
    await expect(sellerPage.locator('main, [role="main"]')).toBeVisible({ timeout: 15000 })
  })
}

const adminPaths = ['/admin', '/admin/today', '/admin/users', '/admin/products', '/admin/listings', '/admin/connections', '/admin/sellers', '/admin/reports', '/admin/social-verification', '/admin/banners', '/admin/storage']
for (const path of adminPaths) {
  test(`管理員頁面渲染: ${path}`, async ({ adminPage }) => {
    await adminPage.goto(path)
    await expect(adminPage.locator('main, [role="main"]')).toBeVisible({ timeout: 15000 })
  })
}
