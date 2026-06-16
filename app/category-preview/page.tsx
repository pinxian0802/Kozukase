import { VARIANTS } from './variants'
import { IconStylesSection, IdolCandidates, PetCandidates } from './icon-styles'

export const metadata = { title: '分類區 — 呈現方式預覽' }

export default function CategoryPreviewPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <header className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-foreground">分類區 — 5 種呈現方式</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          每種都含手機橫滑 + 桌機格狀。請縮放視窗或用手機檢視，挑定後告訴我編號，我把它套回首頁。
        </p>
      </header>

      <div className="space-y-10">
        {VARIANTS.map(({ id, name, desc, Comp }) => (
          <section key={id} className="rounded-2xl border border-border/60 bg-card p-4 md:p-6">
            <div className="mb-4 flex items-baseline gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                {id}
              </span>
              <h2 className="font-heading text-base font-semibold text-foreground">{name}</h2>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">{desc}</p>
            <div className="rounded-xl bg-background p-3 md:p-4">
              <Comp />
            </div>
          </section>
        ))}
      </div>

      <header className="mb-6 mt-14 border-t border-border/60 pt-10">
        <h2 className="font-heading text-2xl font-bold text-foreground">圖示庫風格比較</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          同一批分類、同樣排版，只換圖示集 — 從原生 emoji → 品牌雙色 → 全彩扁平 → 3D，看豐富度差異。
        </p>
      </header>

      <IconStylesSection />

      <header className="mb-6 mt-14 border-t border-border/60 pt-10">
        <h2 className="font-heading text-2xl font-bold text-foreground">「明星偶像」候選圖示</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          都是 fluent-emoji-flat（MIT 可商用）。挑一個喜歡的，把下方的名稱告訴我，我換到首頁。
        </p>
      </header>
      <IdolCandidates />

      <header className="mb-6 mt-14 border-t border-border/60 pt-10">
        <h2 className="font-heading text-2xl font-bold text-foreground">「寵物用品」候選圖示</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          都是 fluent-emoji-flat（MIT 可商用）。挑一個喜歡的，把下方的名稱告訴我，我換到首頁。
        </p>
      </header>
      <PetCandidates />
    </main>
  )
}
