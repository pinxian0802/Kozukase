const HEIC_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']

export function isHeicFile(file: File): boolean {
  if (HEIC_TYPES.includes(file.type.toLowerCase())) return true
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ext === 'heic' || ext === 'heif'
}

// 用 ISO-BMFF 的 ftyp box 確認內容真的是 HEIC/HEIF。
// 結構：前 4 byte = box size，接著 'ftyp'，再來是 major brand。
const HEIC_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1', 'avif'])

function hasHeicSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  const ascii = (start: number, len: number) =>
    String.fromCharCode(...bytes.subarray(start, start + len))
  if (ascii(4, 4) !== 'ftyp') return false
  return HEIC_BRANDS.has(ascii(8, 4).toLowerCase())
}

// ── 背景執行緒（Web Worker）──────────────────────────────────────────
// 單一共用 worker：多張圖排隊處理，libheif WASM 只在 worker 載入一次。
// 解碼在背景跑，主執行緒(UI)不會卡頓。

type WorkerResponse =
  | { id: number; ok: true; blob: Blob }
  | { id: number; ok: false; error: string }

let worker: Worker | null = null
let seq = 0
const pending = new Map<number, { resolve: (blob: Blob) => void; reject: (err: Error) => void }>()

// 是否支援背景解碼（worker + OffscreenCanvas，含 webp 輸出）。
function canUseWorker(): boolean {
  return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined'
}

function getWorker(): Worker {
  if (worker) return worker

  const w = new Worker(new URL('./heic.worker.ts', import.meta.url))

  w.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const data = event.data
    const entry = pending.get(data.id)
    if (!entry) return
    pending.delete(data.id)
    if (data.ok) entry.resolve(data.blob)
    else entry.reject(new Error(data.error))
  }

  // worker 整個掛掉時，讓所有等待中的請求一起失敗並重置，下一次會重建。
  w.onerror = () => {
    const error = new Error('worker error')
    for (const [, entry] of pending) entry.reject(error)
    pending.clear()
    worker = null
  }

  worker = w
  return w
}

function decodeViaWorker(bytes: ArrayBuffer): Promise<Blob> {
  const id = ++seq
  return new Promise<Blob>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, bytes } satisfies { id: number; bytes: ArrayBuffer })
  })
}

// ── 主執行緒後備路徑 ────────────────────────────────────────────────
// 瀏覽器太舊（無 Worker / OffscreenCanvas）時退回這裡，行為與背景版相同，
// 只是會在主執行緒執行（轉檔當下畫面可能短暫卡頓）。

async function canvasToWebp(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: 'image/webp', quality })
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob 回傳 null'))),
      'image/webp',
      quality,
    )
  })
}

async function decodeOnMainThread(bytes: ArrayBuffer): Promise<Blob> {
  const mod = await import('libheif-js/wasm-bundle')
  const HeifDecoder = mod.HeifDecoder ?? (mod as unknown as { default: typeof mod }).default.HeifDecoder
  const decoder = new HeifDecoder()

  const images = decoder.decode(new Uint8Array(bytes))
  const image = images?.[0]
  if (!image) throw new Error('format not supported')

  const width = image.get_width()
  const height = image.get_height()

  const canvas: OffscreenCanvas | HTMLCanvasElement =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height })

  const ctx = canvas.getContext('2d') as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null
  if (!ctx) throw new Error('無法建立 canvas 2d context')

  const imageData = ctx.createImageData(width, height)
  await new Promise<void>((resolve, reject) => {
    image.display(imageData, (displayData) => {
      if (!displayData) {
        reject(new Error('format not supported'))
        return
      }
      resolve()
    })
  })
  ctx.putImageData(imageData, 0, 0)

  return canvasToWebp(canvas, 0.85)
}

export async function normalizeImageFile(file: File): Promise<File> {
  if (!isHeicFile(file)) return file

  const bytes = await file.arrayBuffer()

  if (!hasHeicSignature(new Uint8Array(bytes))) {
    throw new Error('這個檔案副檔名是 HEIC/HEIF，但內容不是可轉換的 HEIC 圖片')
  }

  try {
    const blob = canUseWorker()
      ? await decodeViaWorker(bytes)
      : await decodeOnMainThread(bytes)
    const newName = file.name.replace(/\.(heic|heif)$/i, '.webp')
    return new File([blob], newName, { type: 'image/webp' })
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
