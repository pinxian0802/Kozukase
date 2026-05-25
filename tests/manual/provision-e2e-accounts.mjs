// Idempotent provisioning of the three dedicated E2E accounts the Playwright
// suite expects (buyer / seller / admin). Safe to re-run: find-or-create each
// auth user, (re)set its password, and ensure profile / seller / admin role.
//
// Uses SUPABASE_SERVICE_ROLE_KEY from .env.local (same key the test helpers use).
//   node tests/manual/provision-e2e-accounts.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../../.env.local')

const env = {}
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i === -1) continue
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')

const db = createClient(url, key, { auth: { persistSession: false } })

const PASSWORD = 'e2e-Test-0525!'
const ACCOUNTS = [
  { role: 'buyer', email: 'e2e-buyer@kozukase.test', display: 'E2E Buyer' },
  { role: 'seller', email: 'e2e-seller@kozukase.test', display: 'E2E Seller' },
  { role: 'admin', email: 'e2e-admin@kozukase.test', display: 'E2E Admin' },
]

async function findUserByEmail(email) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const u = data.users.find((u) => u.email === email)
    if (u) return u
    if (data.users.length < 1000) break
  }
  return null
}

async function check(label, { error }) {
  if (error) throw new Error(`${label}: ${error.message}`)
}

for (const acc of ACCOUNTS) {
  let user = await findUserByEmail(acc.email)

  if (user) {
    const attrs = { password: PASSWORD, email_confirm: true }
    if (acc.role === 'admin') attrs.app_metadata = { role: 'admin' }
    const { error } = await db.auth.admin.updateUserById(user.id, attrs)
    if (error) throw new Error(`update ${acc.email}: ${error.message}`)
    console.log(`updated  ${acc.role.padEnd(6)} ${acc.email}  ${user.id}`)
  } else {
    const attrs = { email: acc.email, password: PASSWORD, email_confirm: true }
    if (acc.role === 'admin') attrs.app_metadata = { role: 'admin' }
    const { data, error } = await db.auth.admin.createUser(attrs)
    if (error) throw new Error(`create ${acc.email}: ${error.message}`)
    user = data.user
    console.log(`created  ${acc.role.padEnd(6)} ${acc.email}  ${user.id}`)
  }

  // profile (auth trigger may already create one; upsert is conflict-safe)
  await check(`profile ${acc.email}`, await db
    .from('profiles')
    .upsert({ id: user.id, display_name: acc.display }, { onConflict: 'id' }))

  if (acc.role === 'seller') {
    await check(`seller ${acc.email}`, await db
      .from('sellers')
      .upsert(
        { id: user.id, name: 'E2E Seller', phone_number: '+886900000000', phone_verified: true },
        { onConflict: 'id' },
      ))

    let { data: region } = await db.from('regions').select('id, name').eq('name', '日本').maybeSingle()
    if (!region) {
      const r = await db.from('regions').select('id, name').limit(1).maybeSingle()
      region = r.data
    }
    if (region) {
      await check(`seller_region ${acc.email}`, await db
        .from('seller_regions')
        .upsert({ seller_id: user.id, region_id: region.id }, { onConflict: 'seller_id,region_id' }))
      console.log(`         └─ region: ${region.name}`)
    } else {
      console.warn('         └─ WARNING: no regions row found; seller has no region')
    }
  }
}

console.log('\nDONE. Add these to .env.local:')
console.log(`E2E_BUYER_EMAIL=${ACCOUNTS[0].email}`)
console.log(`E2E_SELLER_EMAIL=${ACCOUNTS[1].email}`)
console.log(`E2E_ADMIN_EMAIL=${ACCOUNTS[2].email}`)
console.log(`E2E_PASSWORD=${PASSWORD}`)
