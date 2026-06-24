export type ImagePurpose =
  | 'product' | 'listing' | 'connection' | 'avatar' | 'message' | 'banner'

export interface R2Object {
  key: string
  lastModified: Date
  size: number
}

export interface Orphan {
  key: string
  url: string
  purpose: ImagePurpose | 'unknown'
  size: number
  lastModified: string
}

const PURPOSES: ImagePurpose[] = [
  'product', 'listing', 'connection', 'avatar', 'message', 'banner',
]

/** 把公開網址還原成 R2 key;非 R2 網址或空值回傳 null。 */
export function r2UrlToKey(
  url: string | null | undefined,
  publicBase: string | undefined,
): string | null {
  if (!url || !publicBase) return null
  const prefix = publicBase.endsWith('/') ? publicBase : `${publicBase}/`
  if (!url.startsWith(prefix)) return null
  const key = url.slice(prefix.length)
  return key.length > 0 ? key : null
}

/** 從 key 路徑 images/{purpose}/... 推斷用途。 */
export function purposeFromKey(key: string): ImagePurpose | 'unknown' {
  const parts = key.split('/')
  if (parts[0] === 'images' && PURPOSES.includes(parts[1] as ImagePurpose)) {
    return parts[1] as ImagePurpose
  }
  return 'unknown'
}

/** R2 有、引用集合沒有、且上傳超過 minAgeMs 的物件即為孤兒。 */
export function findOrphans(params: {
  objects: R2Object[]
  referencedKeys: Set<string>
  publicBase: string | undefined
  now: Date
  minAgeMs: number
}): Orphan[] {
  const { objects, referencedKeys, publicBase, now, minAgeMs } = params
  const base = publicBase?.endsWith('/') ? publicBase.slice(0, -1) : publicBase
  const result: Orphan[] = []
  for (const obj of objects) {
    if (referencedKeys.has(obj.key)) continue
    if (now.getTime() - obj.lastModified.getTime() < minAgeMs) continue
    result.push({
      key: obj.key,
      url: `${base ?? ''}/${obj.key}`,
      purpose: purposeFromKey(obj.key),
      size: obj.size,
      lastModified: obj.lastModified.toISOString(),
    })
  }
  return result
}
