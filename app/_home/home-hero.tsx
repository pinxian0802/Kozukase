import { HomeSearchBar } from '../home-search-bar'

export function HomeHero() {
  return (
    <section className="relative overflow-hidden border-b">
      {/* 背景:之後換成實際日本街景照即可(目前用品牌色漸層墊底) */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-brand-700 to-brand-500" />
      <div aria-hidden className="absolute inset-0 bg-black/45" />

      <div className="relative mx-auto max-w-2xl px-4 py-24 text-center md:py-32">
        <h1 className="font-heading text-3xl font-bold leading-tight text-white md:text-5xl">
          找到最適合你的日本代購
        </h1>
        <p className="mt-4 text-base text-white/85 md:text-lg">
          比較多家代購的價格、評價、運送速度,一次搞定
        </p>
        <div className="mx-auto mt-8 max-w-xl">
          <HomeSearchBar />
        </div>
      </div>
    </section>
  )
}
