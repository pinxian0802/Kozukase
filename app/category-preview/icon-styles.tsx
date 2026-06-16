'use client'

import Link from 'next/link'
import { Icon } from '@iconify/react'
import { categories } from './categories'

const href = (key: string) => `/search?category=${key}`

/** emoji-name slug per category, used by the emoji-based Iconify sets (fluent-emoji…). */
const SLUG: Record<string, string> = {
  fashion: 'dress', beauty: 'lipstick', health: 'pill', food: 'candy',
  electronics: 'mobile-phone', lifestyle: 'house', sports: 'soccer-ball', toys: 'video-game',
  books: 'books', pets: 'paw-prints', culture: 'classical-building', automotive: 'automobile',
  baby: 'baby-bottle', jewelry: 'gem-stone', idol: 'star', other: 'package',
}

/** phosphor icon names (no weight suffix — added per render). */
const PH: Record<string, string> = {
  fashion: 't-shirt', beauty: 'sparkle', health: 'heartbeat', food: 'cookie',
  electronics: 'device-mobile', lifestyle: 'house', sports: 'barbell', toys: 'game-controller',
  books: 'books', pets: 'paw-print', culture: 'bank', automotive: 'car',
  baby: 'baby', jewelry: 'diamond', idol: 'star', other: 'dots-three-outline',
}

/** native unicode emoji per category. */
const EMOJI: Record<string, string> = {
  fashion: '👗', beauty: '💄', health: '💊', food: '🍬',
  electronics: '📱', lifestyle: '🏠', sports: '🏋️', toys: '🎮',
  books: '📚', pets: '🐾', culture: '🏛️', automotive: '🚗',
  baby: '🍼', jewelry: '💎', idol: '⭐', other: '🗂️',
}

/** Shared responsive shell: mobile horizontal scroll, desktop 8-col grid. */
function Row({ children }: { children: (cat: (typeof categories)[number]) => React.ReactNode }) {
  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden">
        {categories.map((cat) => (
          <div key={cat.key} className="shrink-0" style={{ width: 64 }}>{children(cat)}</div>
        ))}
      </div>
      <div className="hidden md:grid md:grid-cols-8 md:gap-2">
        {categories.map((cat) => (
          <div key={cat.key}>{children(cat)}</div>
        ))}
      </div>
    </>
  )
}

function Cell({ href: h, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link href={h} className="group flex flex-col items-center gap-1.5 rounded-lg py-1.5 transition-colors hover:bg-brand-50/50">
      <span className="flex h-11 w-11 items-center justify-center transition-transform group-hover:-translate-y-0.5">
        {children}
      </span>
      <span className="text-center text-[11px] leading-tight text-foreground/70">{label}</span>
    </Link>
  )
}

/* ── ⓐ 原生 Emoji ─────────────────────────────────────────── */
export function EmojiIcons() {
  return (
    <Row>
      {(cat) => (
        <Cell href={href(cat.key)} label={cat.label}>
          <span className="text-[26px] leading-none">{EMOJI[cat.key]}</span>
        </Cell>
      )}
    </Row>
  )
}

/* ── ⓑ Phosphor 雙色（吃品牌 teal）────────────────────────── */
export function PhosphorDuotone() {
  return (
    <Row>
      {(cat) => (
        <Cell href={href(cat.key)} label={cat.label}>
          <Icon icon={`ph:${PH[cat.key]}-duotone`} width={30} height={30} className="text-brand-600" />
        </Cell>
      )}
    </Row>
  )
}

/* ── ⓒ 全彩扁平 Fluent Emoji Flat ─────────────────────────── */
export function FluentFlat() {
  return (
    <Row>
      {(cat) => (
        <Cell href={href(cat.key)} label={cat.label}>
          <Icon icon={`fluent-emoji-flat:${SLUG[cat.key]}`} width={30} height={30} />
        </Cell>
      )}
    </Row>
  )
}

/* ── ⓓ 3D 立體 Fluent Emoji ───────────────────────────────── */
export function Fluent3D() {
  return (
    <Row>
      {(cat) => (
        <Cell href={href(cat.key)} label={cat.label}>
          <Icon icon={`fluent-emoji:${SLUG[cat.key]}`} width={32} height={32} />
        </Cell>
      )}
    </Row>
  )
}

const ICON_STYLES = [
  { id: 'a', name: '原生 Emoji', desc: '零依賴、馬上有色彩。缺點：跨系統長相不一、偏休閒。', Comp: EmojiIcons },
  { id: 'b', name: 'Phosphor 雙色 Duotone', desc: '成套專業、雙色填充吃品牌 teal。比 lucide 豐富但仍克制。', Comp: PhosphorDuotone },
  { id: 'c', name: '全彩扁平 Fluent Emoji Flat', desc: '多色扁平、現代活潑，風格統一勝過原生 emoji。', Comp: FluentFlat },
  { id: 'd', name: '3D 立體 Fluent Emoji', desc: '最有 wow、質感高。最休閒、視覺最重。', Comp: Fluent3D },
] as const

/** 「明星偶像」分類的候選圖示（皆 fluent-emoji-flat，MIT）。 */
const IDOL_CANDIDATES: { slug: string; hint: string }[] = [
  { slug: 'star', hint: '星星（目前）' },
  { slug: 'glowing-star', hint: '發光星 · 更亮眼' },
  { slug: 'sparkles', hint: '閃亮 · 星光感' },
  { slug: 'microphone', hint: '麥克風 · 歌手偶像' },
  { slug: 'crown', hint: '皇冠 · 天王天后' },
  { slug: 'performing-arts', hint: '表演藝術面具' },
  { slug: 'clapper-board', hint: '場記板 · 影視' },
  { slug: 'camera-with-flash', hint: '鎂光燈 · 狗仔' },
  { slug: 'smiling-face-with-sunglasses', hint: '墨鏡 · 巨星感' },
  { slug: 'trophy', hint: '獎盃 · 得獎' },
  { slug: 'headphone', hint: '耳機 · 音樂' },
  { slug: 'musical-notes', hint: '音符 · 演唱' },
  { slug: 'admission-tickets', hint: '票券 · 演唱會' },
  { slug: 'partying-face', hint: '派對臉 · 應援' },
  { slug: 'fire', hint: '火 · 人氣爆棚' },
]

/** 「寵物用品」分類的候選圖示（皆 fluent-emoji-flat，MIT）。 */
const PET_CANDIDATES: { slug: string; hint: string }[] = [
  { slug: 'paw-prints', hint: '腳印（目前）' },
  { slug: 'dog-face', hint: '狗狗臉 · 可愛' },
  { slug: 'cat-face', hint: '貓咪臉 · 可愛' },
  { slug: 'bone', hint: '骨頭 · 用品感最強' },
  { slug: 'dog', hint: '狗（全身）' },
  { slug: 'cat', hint: '貓（全身）' },
  { slug: 'poodle', hint: '貴賓狗' },
  { slug: 'rabbit-face', hint: '兔子臉' },
  { slug: 'hamster', hint: '倉鼠 · 小寵物' },
  { slug: 'bird', hint: '鳥' },
  { slug: 'tropical-fish', hint: '熱帶魚 · 水族' },
  { slug: 'turtle', hint: '烏龜' },
]

function CandidateGrid({ items }: { items: { slug: string; hint: string }[] }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {items.map(({ slug, hint }) => (
        <div
          key={slug}
          className="flex flex-col items-center gap-1.5 rounded-xl border border-border/60 bg-card p-3 text-center"
        >
          <Icon icon={`fluent-emoji-flat:${slug}`} width={40} height={40} />
          <span className="text-[11px] leading-tight text-foreground/80">{hint}</span>
          <code className="text-[9px] leading-tight text-muted-foreground break-all">{slug}</code>
        </div>
      ))}
    </div>
  )
}

export function IdolCandidates() {
  return <CandidateGrid items={IDOL_CANDIDATES} />
}

export function PetCandidates() {
  return <CandidateGrid items={PET_CANDIDATES} />
}

/** Whole comparison section — kept inside this client module so the array
 *  never crosses the RSC boundary (a client module can't export plain data). */
export function IconStylesSection() {
  return (
    <div className="space-y-10">
      {ICON_STYLES.map(({ id, name, desc, Comp }) => (
        <section key={id} className="rounded-2xl border border-border/60 bg-card p-4 md:p-6">
          <div className="mb-1 flex items-baseline gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-xs font-bold uppercase text-background">
              {id}
            </span>
            <h3 className="font-heading text-base font-semibold text-foreground">{name}</h3>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">{desc}</p>
          <div className="rounded-xl bg-background p-3 md:p-4">
            <Comp />
          </div>
        </section>
      ))}
    </div>
  )
}
