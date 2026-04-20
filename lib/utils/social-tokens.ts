import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { getDb } from '@/server/db/client'

const ALGORITHM = 'aes-256-gcm'

function getEncryptionKey(): Buffer {
  const keyHex = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('SOCIAL_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(keyHex, 'hex')
}

/**
 * 使用 AES-256-GCM 加密 access token
 * 輸出格式：base64(iv):base64(authTag):base64(ciphertext)
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(12) // 96 bits for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`
}

/**
 * 解密 access token
 */
export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey()
  const parts = ciphertext.split(':')
  if (parts.length !== 3) throw new Error('Invalid ciphertext format')
  const [ivB64, authTagB64, encryptedB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const encrypted = Buffer.from(encryptedB64, 'base64')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

/**
 * 在賣家進入後台時靜默刷新 social tokens（fire-and-forget）
 * 如果 token 距離過期超過 7 天則跳過；若刷新失敗則清除 token 與賣家欄位。
 */
export async function refreshSocialTokens(sellerId: string): Promise<void> {
  const db = getDb()
  const platforms = ['instagram', 'threads'] as const

  for (const platform of platforms) {
    try {
      const { data: tokenRow } = await db
        .from('social_tokens')
        .select('*')
        .eq('seller_id', sellerId)
        .eq('platform', platform)
        .maybeSingle()

      if (!tokenRow) continue

      // 距離過期超過 7 天則跳過
      const expiresAt = new Date(tokenRow.expires_at as string)
      const daysToExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      if (daysToExpiry > 7) continue

      const accessToken = decryptToken(tokenRow.access_token as string)

      let newToken: string
      let newExpiresAt: Date

      if (platform === 'instagram') {
        const resp = await fetch(
          `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken}`
        )
        if (!resp.ok) throw new Error(`IG refresh HTTP ${resp.status}`)
        const data = await resp.json()
        newToken = data.access_token
        newExpiresAt = new Date(Date.now() + Number(data.expires_in) * 1000)
      } else {
        const resp = await fetch(
          `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${accessToken}`
        )
        if (!resp.ok) throw new Error(`Threads refresh HTTP ${resp.status}`)
        const data = await resp.json()
        newToken = data.access_token
        newExpiresAt = new Date(Date.now() + Number(data.expires_in) * 1000)
      }

      // 更新 social_tokens
      await db.from('social_tokens').update({
        access_token: encryptToken(newToken),
        expires_at: newExpiresAt.toISOString(),
        last_refreshed: new Date().toISOString(),
      }).eq('seller_id', sellerId).eq('platform', platform)

      // 嘗試更新粉絲數（可能因 rate limit 或 scope 不足而失敗，不中斷流程）
      try {
        if (platform === 'instagram') {
          const profileResp = await fetch(
            `https://graph.instagram.com/me?fields=followers_count&access_token=${newToken}`
          )
          if (profileResp.ok) {
            const profile = await profileResp.json()
            if (profile.followers_count !== undefined) {
              await db.from('sellers').update({ ig_follower_count: profile.followers_count }).eq('id', sellerId)
            }
          }
        }
        // Threads API 不一定提供 followers_count，略過
      } catch {
        // 靜默失敗，保留舊粉絲數
      }
    } catch (err) {
      // Token 無效或已撤銷：清除 token 與賣家社群欄位
      console.error(`[refreshSocialTokens] Failed to refresh ${platform} token for seller ${sellerId}:`, err)

      await db.from('social_tokens').delete().eq('seller_id', sellerId).eq('platform', platform)

      const clearData: Record<string, null | boolean> =
        platform === 'instagram'
          ? { ig_handle: null, ig_follower_count: null, ig_connected_at: null }
          : { threads_handle: null, threads_follower_count: null, threads_connected_at: null }

      // 重算 is_social_verified（看另一平台是否仍連結）
      const otherPlatform = platform === 'instagram' ? 'threads' : 'instagram'
      const { data: otherToken } = await db
        .from('social_tokens')
        .select('id')
        .eq('seller_id', sellerId)
        .eq('platform', otherPlatform)
        .maybeSingle()

      clearData.is_social_verified = !!otherToken

      await db.from('sellers').update(clearData).eq('id', sellerId)
    }
  }
}
