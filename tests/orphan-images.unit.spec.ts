import { test, expect } from '@playwright/test'
import { r2UrlToKey, purposeFromKey, findOrphans } from '../server/lib/orphan-images'

test('r2UrlToKey:去掉公開前綴還原成 key', () => {
  expect(r2UrlToKey('https://cdn.x/images/avatar/u/1.webp', 'https://cdn.x'))
    .toBe('images/avatar/u/1.webp')
  // 前綴帶結尾斜線也要正常
  expect(r2UrlToKey('https://cdn.x/images/a.webp', 'https://cdn.x/'))
    .toBe('images/a.webp')
})

test('r2UrlToKey:非 R2 網址、空值回傳 null', () => {
  expect(r2UrlToKey('https://other.com/a.webp', 'https://cdn.x')).toBeNull()
  expect(r2UrlToKey(null, 'https://cdn.x')).toBeNull()
  expect(r2UrlToKey('https://cdn.x/a.webp', undefined)).toBeNull()
  // 只有前綴、沒有 key
  expect(r2UrlToKey('https://cdn.x/', 'https://cdn.x')).toBeNull()
})

test('purposeFromKey:從路徑推斷用途', () => {
  expect(purposeFromKey('images/listing/users/u/x.webp')).toBe('listing')
  expect(purposeFromKey('images/banner/users/u/x.webp')).toBe('banner')
  expect(purposeFromKey('images/weird/x.webp')).toBe('unknown')
  expect(purposeFromKey('totally/other.webp')).toBe('unknown')
})

test('findOrphans:被引用的、未滿年齡門檻的都不算孤兒', () => {
  const now = new Date('2026-06-24T00:00:00Z')
  const old = new Date('2026-06-22T00:00:00Z')   // 2 天前
  const fresh = new Date('2026-06-23T23:00:00Z') // 1 小時前

  const orphans = findOrphans({
    objects: [
      { key: 'images/listing/orphan.webp', lastModified: old, size: 100 },
      { key: 'images/listing/used.webp', lastModified: old, size: 100 },
      { key: 'images/listing/fresh.webp', lastModified: fresh, size: 100 },
    ],
    referencedKeys: new Set(['images/listing/used.webp']),
    publicBase: 'https://cdn.x',
    now,
    minAgeMs: 24 * 60 * 60 * 1000,
  })

  // 只有「沒被引用且超過 24 小時」的那一個
  expect(orphans.map((o) => o.key)).toEqual(['images/listing/orphan.webp'])
  // 帶出完整網址、用途、大小、時間
  expect(orphans[0]).toMatchObject({
    url: 'https://cdn.x/images/listing/orphan.webp',
    purpose: 'listing',
    size: 100,
    lastModified: old.toISOString(),
  })
})

test('findOrphans:門檻為 0 時納入剛上傳的孤兒', () => {
  const now = new Date('2026-06-24T00:00:00Z')
  const justNow = new Date('2026-06-24T00:00:00Z')
  const orphans = findOrphans({
    objects: [{ key: 'images/avatar/x.webp', lastModified: justNow, size: 1 }],
    referencedKeys: new Set(),
    publicBase: 'https://cdn.x',
    now,
    minAgeMs: 0,
  })
  expect(orphans.map((o) => o.key)).toEqual(['images/avatar/x.webp'])
})
