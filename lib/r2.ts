import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'

export const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
})

/** Best-effort 刪除 R2 物件;個別失敗只記錄,不丟出。 */
export async function deleteR2Objects(r2Keys: string[]): Promise<void> {
  await Promise.all(
    r2Keys.map(async (key) => {
      try {
        await s3Client.send(
          new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }),
        )
      } catch (err) {
        console.error(`[r2] 刪除物件失敗: ${key}`, err)
      }
    }),
  )
}
