import Link from 'next/link'
import { Search, ArrowRight, ShoppingBag, Sparkles, Candy, Smartphone, Home, Gamepad2, MoreHorizontal, HeartPulse, Dumbbell, BookOpen, PawPrint, Landmark, Car, Baby, Gem } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { HomeSearchBar } from './home-search-bar'

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
  { key: 'other', label: '其他', icon: MoreHorizontal },
]

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-b from-primary/5 to-background py-16 md:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <h1 className="font-heading text-4xl font-bold text-foreground md:text-5xl">
              找到最適合你的<span className="text-primary">日本代購</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              比較多家代購的價格、評價、運送速度，一次搞定
            </p>
            <div className="mt-8 mx-auto max-w-xl">
              <HomeSearchBar />
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="mx-auto max-w-7xl px-4 py-12">
          <h2 className="font-heading text-2xl font-bold mb-6">商品分類</h2>
          <div className="grid grid-cols-4 gap-4 md:grid-cols-8">
            {categories.map((cat) => {
              const Icon = cat.icon
              return (
                <Link
                  key={cat.key}
                  href={`/search?category=${cat.key}`}
                  className="flex flex-col items-center gap-2 rounded-xl p-4 transition-colors hover:bg-primary/5"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-medium text-center">{cat.label}</span>
                </Link>
              )
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-4 py-12">
          <div className="rounded-2xl bg-gradient-to-r from-primary to-primary/80 p-8 text-center text-primary-foreground md:p-12">
            <h2 className="font-heading text-2xl font-bold md:text-3xl">成為 Kozukase 代購賣家</h2>
            <p className="mt-2 text-primary-foreground/80">讓更多人看到你的代購服務</p>
            <Button size="lg" variant="secondary" className="mt-6" render={<Link href="/become-seller" />}>
              開始上架
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
