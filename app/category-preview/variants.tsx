import Link from 'next/link'
import { categories, type Category } from './categories'

const href = (key: string) => `/search?category=${key}`

/** Shared responsive shell: mobile = horizontal scroll, desktop = grid. */
function Row({
  renderItem,
  desktopCols = 'md:grid-cols-8',
  itemWidth = 64,
}: {
  renderItem: (cat: Category) => React.ReactNode
  desktopCols?: string
  itemWidth?: number
}) {
  return (
    <>
      {/* Mobile */}
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden">
        {categories.map((cat) => (
          <div key={cat.key} className="shrink-0" style={{ width: itemWidth }}>
            {renderItem(cat)}
          </div>
        ))}
      </div>
      {/* Desktop */}
      <div className={`hidden md:grid md:gap-2 ${desktopCols}`}>
        {categories.map((cat) => (
          <div key={cat.key}>{renderItem(cat)}</div>
        ))}
      </div>
    </>
  )
}

/* ── ① Soft Pills ─────────────────────────────────────────── */
export function SoftPills() {
  return (
    <Row
      desktopCols="md:grid-cols-4"
      itemWidth={120}
      renderItem={(cat) => {
        const Icon = cat.icon
        return (
          <Link
            href={href(cat.key)}
            className="flex items-center gap-2 rounded-full bg-brand-50 px-2.5 py-2 transition-colors hover:bg-brand-100 md:px-3"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-brand-500 shadow-sm">
              <Icon className="h-4 w-4" />
            </span>
            <span className="truncate text-xs font-medium text-foreground/80">{cat.label}</span>
          </Link>
        )
      }}
    />
  )
}

/* ── ② Gradient Circles ───────────────────────────────────── */
export function GradientCircles() {
  return (
    <Row
      renderItem={(cat) => {
        const Icon = cat.icon
        return (
          <Link href={href(cat.key)} className="group flex flex-col items-center gap-1.5">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-300 to-brand-700 text-white shadow-md shadow-brand-500/20 transition-transform group-hover:-translate-y-0.5 group-hover:shadow-lg">
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-center text-[11px] leading-tight text-foreground/70">{cat.label}</span>
          </Link>
        )
      }}
    />
  )
}

/* ── ③ Outline Cards ──────────────────────────────────────── */
export function OutlineCards() {
  return (
    <Row
      renderItem={(cat) => {
        const Icon = cat.icon
        return (
          <Link
            href={href(cat.key)}
            className="flex flex-col items-center gap-2 rounded-xl border border-border/70 bg-card p-3 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-center text-[11px] leading-tight text-foreground/70">{cat.label}</span>
          </Link>
        )
      }}
    />
  )
}

/* ── ④ Color-coded ────────────────────────────────────────── */
export function ColorCoded() {
  return (
    <Row
      renderItem={(cat) => {
        const Icon = cat.icon
        return (
          <Link href={href(cat.key)} className="group flex flex-col items-center gap-1.5">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-2xl transition-transform group-hover:-translate-y-0.5"
              style={{ backgroundColor: cat.tint.bg, color: cat.tint.fg }}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-center text-[11px] leading-tight text-foreground/70">{cat.label}</span>
          </Link>
        )
      }}
    />
  )
}

/* ── ⑤ Minimal Large Icon ─────────────────────────────────── */
export function Minimal() {
  return (
    <Row
      renderItem={(cat) => {
        const Icon = cat.icon
        return (
          <Link
            href={href(cat.key)}
            className="group flex flex-col items-center gap-2 rounded-lg py-2 transition-colors hover:bg-brand-50/60"
          >
            <Icon className="h-7 w-7 text-foreground/60 transition-colors group-hover:text-brand-500" strokeWidth={1.5} />
            <span className="text-center text-[11px] leading-tight text-muted-foreground transition-colors group-hover:text-foreground">
              {cat.label}
            </span>
          </Link>
        )
      }}
    />
  )
}

/* ── ⑥ Typographic Index ──────────────────────────────────── */
export function TypographicIndex() {
  return (
    <div className="border-y border-foreground/15">
      <div className="grid grid-cols-2 md:grid-cols-4">
        {categories.map((cat, i) => (
          <Link
            key={cat.key}
            href={href(cat.key)}
            className="group flex items-baseline gap-2.5 border-b border-foreground/10 px-1 py-3.5 transition-colors last:border-b-0 md:[&:nth-last-child(-n+4)]:border-b-0"
          >
            <span className="font-mono text-[11px] tabular-nums text-brand-500 transition-colors group-hover:text-brand-700">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="font-heading text-sm font-bold tracking-tight text-foreground transition-all group-hover:translate-x-0.5 group-hover:text-brand-700 md:text-base">
              {cat.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

/* ── ⑦ Text Tag Flow ──────────────────────────────────────── */
export function TagFlow() {
  return (
    <div className="flex flex-wrap gap-2 md:gap-2.5">
      {categories.map((cat) => (
        <Link
          key={cat.key}
          href={href(cat.key)}
          className="rounded-full border border-border bg-card px-3.5 py-1.5 text-[13px] text-foreground/75 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 md:text-sm"
        >
          {cat.label}
        </Link>
      ))}
    </div>
  )
}

export const VARIANTS = [
  { id: 1, name: '柔和膠囊 Soft Pills', desc: '圓 icon + 文字水平排在膠囊裡，brand-50 底、hover brand-100。精緻有呼吸感。', Comp: SoftPills },
  { id: 2, name: '漸層圓 Gradient Circles', desc: 'brand 漸層圓底 + 白 icon，hover 微浮起。品牌感最強、活潑。', Comp: GradientCircles },
  { id: 3, name: '描邊卡片 Outline Cards', desc: '白底細框卡片，hover 上浮 + brand 邊框陰影。乾淨現代電商風。', Comp: OutlineCards },
  { id: 4, name: '彩色分類 Color-coded', desc: '每類不同柔和色相的圓角底，繽紛好辨識。', Comp: ColorCoded },
  { id: 5, name: '大圖標極簡 Minimal', desc: '無底色、放大線性 icon，hover 才上色。留白多、最輕盈。', Comp: Minimal },
  { id: 6, name: '大字排版索引 Typographic Index', desc: '完全不用 icon，編號 + 粗體中文做成紙本目錄式索引。最有「設計過」的人味。', Comp: TypographicIndex },
  { id: 7, name: '文字標籤流 Tag Flow', desc: '分類只是一排排純文字 chip，像篩選列／標籤雲。安靜、不搶版面。', Comp: TagFlow },
] as const
