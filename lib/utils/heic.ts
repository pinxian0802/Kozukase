const HEIC_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']

export function isHeicFile(file: File): boolean {
  if (HEIC_TYPES.includes(file.type.toLowerCase())) return true
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ext === 'heic' || ext === 'heif'
}

export async function normalizeImageFile(file: File): Promise<File> {
  if (!isHeicFile(file)) return file

  try {
    const { heicTo, isHeic } = await import('heic-to')
    const matchesHeicSignature = await isHeic(file)

    if (!matchesHeicSignature) {
      throw new Error('這個檔案副檔名是 HEIC/HEIF，但內容不是可轉換的 HEIC 圖片')
    }

    const blob = await heicTo({
      blob: file,
      type: 'image/jpeg',
      quality: 0.9,
    })
    const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg')
    return new File([blob], newName, { type: 'image/jpeg' })
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '未知錯誤'

    throw new Error(
      message.includes('format not supported')
        ? '這張 HEIC 圖片目前無法在瀏覽器中轉換，請先用手機匯出為 JPEG 後再上傳'
        : `HEIC 轉換失敗：${message}`,
    )
  }
}