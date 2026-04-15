import { NextResponse } from 'next/server'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxFileSize = 5 * 1024 * 1024

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
})

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const formData = await request.formData()
    const purpose = String(formData.get('purpose') ?? '')
    const file = formData.get('file')

    if (!['product', 'listing', 'connection', 'avatar'].includes(purpose)) {
      return NextResponse.json({ error: '不支援的圖片用途' }, { status: 400 })
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: '找不到上傳檔案' }, { status: 400 })
    }

    if (!allowedTypes.has(file.type)) {
      return NextResponse.json({ error: '不支援的圖片格式，請使用 JPEG、PNG 或 WebP' }, { status: 400 })
    }

    if (file.size > maxFileSize) {
      return NextResponse.json({ error: '圖片大小不可超過 5MB' }, { status: 400 })
    }

    const r2Key = `${purpose}/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`
    const body = Buffer.from(await file.arrayBuffer())

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: r2Key,
      Body: body,
      ContentType: file.type || 'image/webp',
      ContentLength: file.size,
    }))

    return NextResponse.json({
      r2Key,
      publicUrl: `${process.env.R2_PUBLIC_URL}/${r2Key}`,
    })
  } catch (error) {
    console.error('Upload route failed:', error)
    return NextResponse.json({ error: '圖片上傳失敗' }, { status: 500 })
  }
}