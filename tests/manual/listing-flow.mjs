/**
 * Manual API smoke test for the listing flow.
 *
 * Run from my-app:
 *   node tests/manual/listing-flow.mjs
 */

import { createClient } from '@supabase/supabase-js'

const BASE_URL = 'http://localhost:3000'
const SUPABASE_URL = 'https://odetecnsfwvugnrfynmi.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZXRlY25zZnd2dWducmZ5bm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNjk1NTMsImV4cCI6MjA5MTc0NTU1M30.fuQeIRFINuVQInL3USv_aHtdO-Q3rPaRS0xy1Vpuyh8'
const TEST_EMAIL = 'test@test.com'
const TEST_PASS = 'poiu0987'

function log(ok, label, detail) {
  const icon = ok ? '[PASS]' : '[FAIL]'
  const suffix = detail ? ' -> ' + detail : ''
  console.log(icon + ' ' + label + suffix)
}

function buildAuthCookie(session) {
  const value = JSON.stringify({
    access_token: session.access_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user,
  })
  return 'sb-odetecnsfwvugnrfynmi-auth-token=' + encodeURIComponent(value)
}

async function trpc(procedure, input, cookieHeader) {
  const [namespace, method] = procedure.split('.')
  const url = `${BASE_URL}/api/trpc/${namespace}.${method}`
  const isQuery = method.startsWith('get') || ['search', 'browse', 'myListings', 'myListingCount'].includes(method)
  const headers = { 'Content-Type': 'application/json' }
  if (cookieHeader) headers.Cookie = cookieHeader

  const wrappedInput = input !== undefined ? { json: input } : { json: null }

  const response = isQuery
    ? await fetch(`${url}?input=${encodeURIComponent(JSON.stringify({ '0': wrappedInput }))}&batch=1`, { headers })
    : await fetch(`${url}?batch=1`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ '0': wrappedInput }),
      })

  const json = await response.json()
  const result = Array.isArray(json) ? json[0] : json
  if (result.error) {
    const errData = result.error?.json ?? result.error
    throw new Error(errData?.message ?? JSON.stringify(errData))
  }

  const data = result.result?.data
  return data?.json !== undefined ? data.json : data
}

const results = []
const pass = (label, detail) => { results.push({ ok: true, label, detail }); log(true, label, detail) }
const fail = (label, error) => { results.push({ ok: false, label, detail: error }); log(false, label, error) }

let cookieHeader = null
let productId = null
let listingId = null
let draftId2 = null

try {
  const supabase = createClient(SUPABASE_URL, ANON_KEY)
  const { data, error } = await supabase.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASS })
  if (error || !data.session) throw new Error(error?.message ?? 'No session returned')
  cookieHeader = buildAuthCookie(data.session)
  pass('auth.login', 'uid=' + data.session.user.id.slice(0, 8) + '...')
} catch (error) {
  fail('auth.login', error.message)
  process.exit(1)
}

try {
  const session = await trpc('auth.getSession', undefined, cookieHeader)
  if (!session?.profile) throw new Error('No profile returned')
  pass('auth.getSession', 'isSeller=' + session.isSeller)
  if (!session.isSeller) {
    fail('SKIP: test account is not a seller', '')
    process.exit(1)
  }
} catch (error) {
  fail('auth.getSession', error.message)
  process.exit(1)
}

try {
  const data = await trpc('product.search', { query: 'nike', limit: 5 }, cookieHeader)
  pass('product.search', 'returned ' + (data ?? []).length + ' results')
} catch (error) {
  fail('product.search', error.message)
}

try {
  const data = await trpc('product.create', { name: '[TEST] API test product ' + Date.now(), brand: 'TestBrand' }, cookieHeader)
  productId = data?.id
  if (!productId) throw new Error('No id returned')
  pass('product.create', 'id=' + productId.slice(0, 8) + '... name="' + data.name + '"')
} catch (error) {
  fail('product.create', error.message)
  process.exit(1)
}

try {
  const data = await trpc('listing.create', { product_id: productId, status: 'draft' }, cookieHeader)
  listingId = data?.id
  if (!listingId) throw new Error('No id returned')
  pass('listing.create (draft)', 'id=' + listingId.slice(0, 8) + '... status=' + data.status)
} catch (error) {
  fail('listing.create (draft)', error.message)
  process.exit(1)
}

try {
  const data = await trpc('listing.update', {
    id: listingId,
    price: 1500,
    is_price_on_request: false,
    shipping_date: '2026-05-06',
    post_url: 'https://www.instagram.com/p/test123/',
    note: 'API test note',
  }, cookieHeader)
  if (data?.price !== 1500) throw new Error('Expected price=1500, got ' + data?.price)
  pass('listing.update', 'price=' + data.price + ' shipping_date=' + data.shipping_date)
} catch (error) {
  fail('listing.update', error.message)
}

try {
  const data = await trpc('listing.publish', { id: listingId }, cookieHeader)
  if (data?.status !== 'active') throw new Error('Expected status=active, got ' + data?.status)
  pass('listing.publish', 'status=' + data.status)
} catch (error) {
  fail('listing.publish', error.message)
}

try {
  const data = await trpc('listing.myListings', { limit: 10 }, cookieHeader)
  const found = data?.items?.find((listing) => listing.id === listingId)
  if (!found) throw new Error('Published listing not found in myListings')
  pass('listing.myListings', 'found listing in list, status=' + found.status)
} catch (error) {
  fail('listing.myListings', error.message)
}

try {
  const data = await trpc('listing.myListingCount', undefined, cookieHeader)
  if (typeof data?.total !== 'number') throw new Error('No total returned')
  pass('listing.myListingCount', 'total=' + data.total + ' active=' + data.active + ' draft=' + data.draft)
} catch (error) {
  fail('listing.myListingCount', error.message)
}

try {
  const data = await trpc('listing.getById', { id: listingId }, cookieHeader)
  if (!data?.id) throw new Error('Not found or still hidden')
  pass('listing.getById', 'status=' + data.status + ' product=' + data.product?.name)
} catch (error) {
  fail('listing.getById', error.message)
}

try {
  const data = await trpc('listing.deactivate', { id: listingId }, cookieHeader)
  if (data?.status !== 'inactive') throw new Error('Expected status=inactive, got ' + data?.status)
  pass('listing.deactivate', 'status=' + data.status)
} catch (error) {
  fail('listing.deactivate', error.message)
}

try {
  const data = await trpc('listing.reactivate', { id: listingId }, cookieHeader)
  if (data?.status !== 'active') throw new Error('Expected status=active, got ' + data?.status)
  pass('listing.reactivate', 'status=' + data.status)
} catch (error) {
  fail('listing.reactivate', error.message)
}

try {
  const data = await trpc('listing.create', { product_id: productId, status: 'draft' }, cookieHeader)
  draftId2 = data?.id
  if (!draftId2) throw new Error('No id returned')
  pass('listing.create (2nd draft for delete test)', 'id=' + draftId2.slice(0, 8) + '...')
} catch (error) {
  fail('listing.create (2nd draft for delete test)', error.message)
}

if (draftId2) {
  try {
    const data = await trpc('listing.delete', { id: draftId2 }, cookieHeader)
    if (!data?.success) throw new Error('delete did not return success=true')
    pass('listing.delete (draft)', 'success=true')
  } catch (error) {
    fail('listing.delete (draft)', error.message)
  }
}

try {
  await trpc('listing.delete', { id: listingId }, cookieHeader)
  fail('listing.delete (active should be rejected)', 'Expected error but got success')
} catch (error) {
  const message = error.message ?? ''
  if (message.includes('only delete draft') || message.includes('draft') || message.includes('草稿')) {
    pass('listing.delete (active -> correctly rejected)', message)
  } else {
    fail('listing.delete (active -> correctly rejected)', 'Wrong error: ' + message)
  }
}

try {
  await trpc('listing.deactivate', { id: listingId }, cookieHeader)
  pass('cleanup: deactivate main listing', '')
} catch (error) {
  fail('cleanup: deactivate main listing', error.message)
}

console.log('\n===================================')
const passed = results.filter((result) => result.ok).length
const failed = results.filter((result) => !result.ok).length
console.log('Results: ' + passed + ' passed, ' + failed + ' failed out of ' + results.length + ' tests')
if (failed > 0) {
  console.log('\nFailed tests:')
  results.filter((result) => !result.ok).forEach((result) => console.log('  [FAIL] ' + result.label + ': ' + result.detail))
}
console.log('===================================\n')
process.exit(failed > 0 ? 1 : 0)
