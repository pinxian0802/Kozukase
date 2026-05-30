// 背景執行緒：把費 CPU 的 HEIC 解碼(WASM 解 HEVC)+ webp 編碼搬離主執行緒，
// 避免轉檔時 UI 卡頓。主執行緒透過 postMessage 送原始位元組進來，這裡處理完回傳 webp blob。

interface DecodeRequest {
  id: number
  bytes: ArrayBuffer
}

type DecodeResponse =
  | { id: number; ok: true; blob: Blob }
  | { id: number; ok: false; error: string }

self.onmessage = async (event: MessageEvent<DecodeRequest>) => {
  const { id, bytes } = event.data

  try {
    const mod = await import('libheif-js/wasm-bundle')
    const HeifDecoder = mod.HeifDecoder ?? (mod as unknown as { default: typeof mod }).default.HeifDecoder
    const decoder = new HeifDecoder()

    const images = decoder.decode(new Uint8Array(bytes))
    const image = images?.[0]
    if (!image) throw new Error('format not supported')

    const width = image.get_width()
    const height = image.get_height()

    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
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

    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.85 })
    const response: DecodeResponse = { id, ok: true, blob }
    self.postMessage(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const response: DecodeResponse = { id, ok: false, error: message }
    self.postMessage(response)
  }
}
