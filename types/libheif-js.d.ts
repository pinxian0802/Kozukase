// libheif-js 的真 WASM bundle 走 subpath import，套件未附此路徑的型別，這裡補上最小宣告。
declare module 'libheif-js/wasm-bundle' {
  export interface HeifImage {
    get_width(): number
    get_height(): number
    display(
      imageData: ImageData,
      callback: (displayData: ImageData | null) => void,
    ): void
  }

  export interface HeifDecoder {
    decode(buffer: Uint8Array): HeifImage[]
  }

  export const HeifDecoder: new () => HeifDecoder
}
