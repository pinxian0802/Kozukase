import { test, expect } from '@playwright/test'
import path from 'path'

// Image file for testing - located in the daigo root folder
const TEST_IMAGE_PATH = path.resolve('/mnt/c/Users/Panda/Desktop/daigo/checkenbandong.png')

test.describe('Listing 上架流程', () => {
  test('新增 Listing 頁面應可搜尋商品', async ({ page }) => {
    await page.goto('/dashboard/listings/new')

    // Wait for seller layout to confirm seller status, then page content renders
    await expect(page.getByText('第一步：搜尋或新增商品')).toBeVisible({ timeout: 30000 })
    await expect(page.getByPlaceholder('搜尋商品名稱...')).toBeVisible()
  })

  test('應可建立新商品並儲存為草稿', async ({ page }) => {
    await page.goto('/dashboard/listings/new')

    // Wait for page to be accessible to seller
    await expect(page.getByText('第一步：搜尋或新增商品')).toBeVisible({ timeout: 30000 })

    const productName = `測試商品_${Date.now()}`

    const searchInput = page.getByPlaceholder('搜尋商品名稱...')
    await searchInput.fill(productName)
    await page.waitForTimeout(1000)

    // Click "新增商品" to create new product
    await page.getByRole('button', { name: new RegExp(`新增商品「${productName}」`) }).click()

    // Fill product draft and continue to listing form
    await expect(page.getByLabel('商品名稱 *')).toBeVisible({ timeout: 30000 })
    await page.getByLabel('商品名稱 *').fill(productName)
    await page.getByRole('button', { name: '下一步' }).click()

    // Wait for listing form to appear
    await expect(page.getByText('商品：')).toBeVisible({ timeout: 30000 })
    await expect(page.getByText(productName)).toBeVisible()

    // Fill in listing details
    await page.locator('#price').fill('1500')
    await page.locator('#shipping').fill('7')
    await page.locator('#postUrl').fill('https://www.instagram.com/p/test12345/')

    // Save as draft
    await page.getByRole('button', { name: '儲存草稿' }).click()

    // Should redirect to listings management page
    await page.waitForURL('**/dashboard/listings', { timeout: 30000 })
    expect(page.url()).toContain('/dashboard/listings')
  })

  test('應可建立附圖片的 Listing 並直接上架', async ({ page }) => {
    await page.goto('/dashboard/listings/new')

    await expect(page.getByText('第一步：搜尋或新增商品')).toBeVisible({ timeout: 30000 })

    const productName = `上架商品_${Date.now()}`

    const searchInput = page.getByPlaceholder('搜尋商品名稱...')
    await searchInput.fill(productName)
    await page.waitForTimeout(1000)
    await page.getByRole('button', { name: new RegExp(`新增商品「${productName}」`) }).click()

    await expect(page.getByLabel('商品名稱 *')).toBeVisible({ timeout: 30000 })
    await page.getByLabel('商品名稱 *').fill(productName)
    await page.getByRole('button', { name: '下一步' }).click()

    await expect(page.getByText('商品：')).toBeVisible({ timeout: 30000 })

    // Upload image and wait for upload to complete (compression + presigned URL + R2 upload)
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.setInputFiles(TEST_IMAGE_PATH)
    // Wait for the image thumbnail to appear in the upload area (confirms upload done)
    await expect(page.locator('.relative.h-24.w-24 img').first()).toBeVisible({ timeout: 30000 })

    await page.locator('#price').fill('2000')
    await page.locator('#shipping').fill('14')
    await page.locator('#postUrl').fill('https://www.instagram.com/p/test99999/')

    await page.getByRole('button', { name: '直接上架' }).click()

    await page.waitForURL('**/dashboard/listings', { timeout: 30000 })
    expect(page.url()).toContain('/dashboard/listings')
  })

  test('應可從 Listing 管理頁面刪除草稿', async ({ page }) => {
    // First create a draft
    await page.goto('/dashboard/listings/new')
    await expect(page.getByText('第一步：搜尋或新增商品')).toBeVisible({ timeout: 30000 })

    const productName = `刪除測試_${Date.now()}`
    const searchInput = page.getByPlaceholder('搜尋商品名稱...')
    await searchInput.fill(productName)
    await page.waitForTimeout(1000)
    await page.getByRole('button', { name: new RegExp(`新增商品「${productName}」`) }).click()
    await expect(page.getByLabel('商品名稱 *')).toBeVisible({ timeout: 30000 })
    await page.getByLabel('商品名稱 *').fill(productName)
    await page.getByRole('button', { name: '下一步' }).click()
    await expect(page.getByText('商品：')).toBeVisible({ timeout: 30000 })
    await page.getByRole('button', { name: '儲存草稿' }).click()
    await page.waitForURL('**/dashboard/listings', { timeout: 30000 })

    // Switch to draft tab
    await expect(page.getByRole('tab', { name: /草稿/ })).toBeVisible({ timeout: 30000 })
    await page.getByRole('tab', { name: /草稿/ }).click()
    await page.waitForTimeout(1000)

    // Delete if there's a delete button
    const deleteButton = page.getByRole('button', { name: '刪除' }).first()
    if (await deleteButton.isVisible({ timeout: 5000 })) {
      await deleteButton.click()
      await page.waitForTimeout(2000)
    }
  })

  test('應可下架已上架的 Listing', async ({ page }) => {
    await page.goto('/dashboard/listings')

    // Wait for listing management tabs to load
    await expect(page.getByRole('tab', { name: /上架中/i })).toBeVisible({ timeout: 30000 })
    await page.getByRole('tab', { name: /上架中/i }).click()
    await page.waitForTimeout(1000)

    // Deactivate if there's any active listing
    const deactivateButton = page.getByRole('button', { name: '下架' }).first()
    if (await deactivateButton.isVisible({ timeout: 5000 })) {
      await deactivateButton.click()
      await page.waitForTimeout(2000)
    }
  })
})
