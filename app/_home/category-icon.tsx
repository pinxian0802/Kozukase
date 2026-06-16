import { categoryIconBodies } from './category-icons'

/**
 * 首頁商品分類圖示 — Fluent Emoji Flat（MIT），SVG body 內嵌於 category-icons.ts。
 * 純渲染、無 hook，可在 server component 直接使用；跨平台像素級一致、零外部 API。
 */
export function CategoryIcon({ categoryKey, className }: { categoryKey: string; className?: string }) {
  const body = categoryIconBodies[categoryKey]
  if (!body) return null
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: body }}
    />
  )
}
