import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const testEmail = process.env.TEST_ACCOUNT ?? 'test@test.com'

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase env for admin tests')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const toggleEmail = process.env.TEST_ADMIN_TARGET_ACCOUNT ?? 'admin-toggle-target@test.com'

async function ensureTestUserIsAdmin() {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error

  const user = data.users.find((item) => item.email === testEmail)
  if (!user) {
    throw new Error(`Test user not found: ${testEmail}`)
  }

  const currentRole = user.app_metadata?.role
  if (currentRole === 'admin') return user.id

  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...(user.app_metadata ?? {}),
      role: 'admin',
    },
  })
  if (updateError) throw updateError

  return user.id
}

async function findUserIdByEmail(email: string) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error

  return data.users.find((item) => item.email === email)?.id ?? null
}

async function ensureToggleTargetUser() {
  const { data: createData, error: createError } = await supabase.auth.admin.createUser({
    email: toggleEmail,
    password: 'AdminToggle123!',
    email_confirm: true,
    user_metadata: {
      full_name: 'Admin Toggle Target',
    },
  })

  if (createError && !String(createError.message).toLowerCase().includes('already')) {
    throw createError
  }

  const userId = createData.user?.id ?? (await findUserIdByEmail(toggleEmail))
  if (!userId) {
    throw new Error(`Toggle target not found: ${toggleEmail}`)
  }

  const { error: resetError } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: {
      role: 'user',
    },
  })
  if (resetError) throw resetError

  return userId
}

test.describe.serial('admin backend', () => {
  test.beforeEach(async () => {
    await ensureTestUserIsAdmin()
    await ensureToggleTargetUser()
  })

  test('admin home shows entry cards', async ({ page }) => {
    await page.goto('/admin')

    await expect(page.getByRole('heading', { name: '管理後台總覽' })).toBeVisible()
    await expect(page.getByRole('link', { name: '使用者管理' })).toBeVisible()
    await expect(page.getByRole('link', { name: '商品管理' })).toBeVisible()
  })

  test('admin users page can toggle admin role', async ({ page }) => {
    await page.goto('/admin/users')

    const row = page.getByRole('row', { name: new RegExp(toggleEmail) }).first()
    await expect(row).toBeVisible()
    await expect(row.getByRole('button', { name: '設為管理員' })).toBeVisible()

    await row.getByRole('button', { name: '設為管理員' }).click()
    await expect(row.getByRole('button', { name: '取消管理員' })).toBeVisible()

    await row.getByRole('button', { name: '取消管理員' }).click()
    await expect(row.getByRole('button', { name: '設為管理員' })).toBeVisible()
  })

  test('admin products page has an edit action', async ({ page }) => {
    await page.goto('/admin/products')

    await expect(page.getByRole('heading', { name: '商品管理' })).toBeVisible()
    await expect(page.getByRole('button', { name: '編輯' }).first()).toBeVisible()
  })
})
