import Link from 'next/link'
import { format } from 'date-fns'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { ProductCard } from '@/components/product/product-card'
import { ConnectionCard } from '@/components/connection/connection-card'
import { createServerCaller } from '@/lib/trpc/server'
import { HomeHero } from './_home/home-hero'
import { SectionCarousel } from './_home/section-carousel'
import { SellerCtaBanner } from './_home/seller-cta-banner'
import { CategoryIcon } from './_home/category-icon'
import { PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'
import { JsonLd } from '@/lib/seo/jsonld'
import { buildOrganizationJsonLd, buildWebSiteJsonLd } from '@/lib/seo/builders'

const categories = Object.entries(PRODUCT_CATEGORY_LABELS).map(([key, label]) => ({ key, label }))

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
      <JsonLd data={[buildOrganizationJsonLd(), buildWebSiteJsonLd()]} />
      <Header />
      <main className="flex-1">
        <HomeHero slides={heroSlides} />

        {/* Categories */}
        <section className="mx-auto max-w-6xl px-3 py-2 md:px-4 md:py-10">
          <h2 className="font-heading text-[13px] font-bold mb-1.5 text-foreground md:text-2xl md:mb-5 hidden md:block">商品分類</h2>
          {/* Mobile: horizontal scroll */}
          <div className="flex gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden">
            {categories.map((cat) => (
              <Link
                key={cat.key}
                href={`/search?category=${cat.key}`}
                className="flex flex-col items-center gap-1 shrink-0 px-1.5"
                style={{ width: 56 }}
              >
                <div className="flex h-9 w-9 items-center justify-center">
                  <CategoryIcon categoryKey={cat.key} className="h-8 w-8" />
                </div>
                <span className="text-[10px] text-center text-muted-foreground leading-tight whitespace-nowrap">{cat.label}</span>
              </Link>
            ))}
          </div>
          {/* Desktop: grid */}
          <div className="hidden md:grid md:grid-cols-10 md:gap-1">
            {categories.map((cat) => (
              <Link
                key={cat.key}
                href={`/search?category=${cat.key}`}
                className="group flex flex-col items-center gap-2 rounded-lg p-3"
              >
                <div className="flex h-11 w-11 items-center justify-center transition-transform group-hover:-translate-y-0.5">
                  <CategoryIcon categoryKey={cat.key} className="h-10 w-10" />
                </div>
                <span className="text-xs text-center text-muted-foreground leading-tight transition-colors group-hover:text-foreground">{cat.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* 熱門商品 */}
        {popularProducts.length > 0 && (
          <div className="bg-surface-muted/40">
            <SectionCarousel title="熱門商品" viewAllHref="/search">
              {popularProducts.map((p) => (
                <div key={p.id} className="w-full md:w-[calc((100%-64px)/5)] md:shrink-0 md:snap-start">
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
              <div key={c.id} className="w-full md:w-[calc((100%-48px)/4)] md:shrink-0 md:snap-start">
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
