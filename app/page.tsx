import Link from 'next/link'
import { format } from 'date-fns'
import {
  ShoppingBag, Sparkles, Candy, Smartphone, Home, Gamepad2, MoreHorizontal,
  HeartPulse, Dumbbell, BookOpen, PawPrint, Landmark, Car, Baby, Gem, Star,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { ProductCard } from '@/components/product/product-card'
import { ConnectionCard } from '@/components/connection/connection-card'
import { createServerCaller } from '@/lib/trpc/server'
import { HomeHero } from './_home/home-hero'
import { SectionCarousel } from './_home/section-carousel'
import { SellerCtaBanner } from './_home/seller-cta-banner'

const categories = [
  { key: 'fashion', label: '時尚穿搭', icon: ShoppingBag },
  { key: 'beauty', label: '美妝保養', icon: Sparkles },
  { key: 'health', label: '保健品', icon: HeartPulse },
  { key: 'food', label: '食品零食', icon: Candy },
  { key: 'electronics', label: '3C 電器', icon: Smartphone },
  { key: 'lifestyle', label: '生活雜貨', icon: Home },
  { key: 'sports', label: '運動戶外', icon: Dumbbell },
  { key: 'toys', label: '公仔玩具', icon: Gamepad2 },
  { key: 'books', label: '書籍文具', icon: BookOpen },
  { key: 'pets', label: '寵物用品', icon: PawPrint },
  { key: 'culture', label: '文化紀念品', icon: Landmark },
  { key: 'automotive', label: '汽機車用品', icon: Car },
  { key: 'baby', label: '母嬰用品', icon: Baby },
  { key: 'jewelry', label: '珠寶首飾', icon: Gem },
  { key: 'idol', label: '明星偶像', icon: Star },
  { key: 'other', label: '其他', icon: MoreHorizontal },
]

export default async function HomePage() {
  const trpc = await createServerCaller()
  const today = format(new Date(), 'yyyy-MM-dd')

  const [popularProducts, connectionsResult, banners] = await Promise.all([
    trpc.product.popular({ limit: 12 }),
    trpc.connection.browse({ active_during: { start: today }, page: 1, limit: 10 }),
    trpc.banner.listActive(),
  ])
  const upcomingConnections = connectionsResult.items
  const heroSlides = banners.map((b) => ({ id: b.id, src: b.image_url, href: b.link_url, alt: '' }))

  return (
    <>
      <Header />
      <main className="flex-1">
        <HomeHero slides={heroSlides} />

        {/* Categories */}
        <section className="mx-auto max-w-6xl px-3 py-2 md:px-4 md:py-10">
          <h2 className="font-heading text-[13px] font-bold mb-1.5 text-foreground md:text-2xl md:mb-5 hidden md:block">商品分類</h2>
          {/* Mobile: horizontal scroll */}
          <div className="flex gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden">
            {categories.map((cat) => {
              const Icon = cat.icon
              return (
                <Link
                  key={cat.key}
                  href={`/search?category=${cat.key}`}
                  className="flex flex-col items-center gap-1 shrink-0 px-1.5"
                  style={{ width: 56 }}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] text-center text-muted-foreground leading-tight whitespace-nowrap">{cat.label}</span>
                </Link>
              )
            })}
          </div>
          {/* Desktop: grid */}
          <div className="hidden md:grid md:grid-cols-8 md:gap-1">
            {categories.map((cat) => {
              const Icon = cat.icon
              return (
                <Link
                  key={cat.key}
                  href={`/search?category=${cat.key}`}
                  className="group flex flex-col items-center gap-2 rounded-md p-3 transition-colors hover:bg-brand-50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-500">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs text-center text-muted-foreground leading-tight">{cat.label}</span>
                </Link>
              )
            })}
          </div>
        </section>

        {/* 熱門商品 */}
        {popularProducts.length > 0 && (
          <div className="bg-surface-muted/40">
            <SectionCarousel title="熱門商品" viewAllHref="/search">
              {popularProducts.map((p) => (
                <div key={p.id} className="w-[100px] shrink-0 snap-start md:w-[calc((100%-64px)/5)]">
                  <ProductCard product={p} imageAspect="1/1" />
                </div>
              ))}
            </SectionCarousel>
          </div>
        )}

        {/* 即將出發的連線代購 */}
        {upcomingConnections.length > 0 && (
          <SectionCarousel title="即將出發的連線代購" viewAllHref="/connections">
            {upcomingConnections.map((c) => (
              <div key={c.id} className="w-[156px] shrink-0 snap-start md:w-[calc((100%-48px)/4)]">
                <ConnectionCard connection={c} />
              </div>
            ))}
          </SectionCarousel>
        )}

        {/* CTA — 成為賣家（Mountain Vista 旅遊主題 banner，見 _home/seller-cta-banner） */}
        <SellerCtaBanner />
      </main>
      <Footer />
    </>
  )
}
