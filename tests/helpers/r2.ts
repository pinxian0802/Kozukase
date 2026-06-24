import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

let _s3: S3Client | null = null

function s3(): S3Client {
  if (_s3) return _s3
  _s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
  return _s3
}

/** 直接往 R2 塞一個物件(測試用,模擬已上傳的圖)。 */
export async function putR2Object(key: string, body = 'e2e'): Promise<void> {
  await s3().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: 'image/webp',
  }))
}

/** 查 R2 物件是否存在。 */
export async function r2ObjectExists(key: string): Promise<boolean> {
  try {
    await s3().send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }))
    return true
  } catch {
    return false
  }
}

/** 清理:刪掉測試塞的 R2 物件(best-effort)。 */
export async function deleteR2Object(key: string): Promise<void> {
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }))
  } catch {
    /* best-effort */
  }
}
