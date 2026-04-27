import Link from 'next/link'
import { ShoppingBag, Sparkles, Candy, Smartphone, Home, Gamepad2, MoreHorizontal, HeartPulse, Dumbbell, BookOpen, PawPrint, Landmark, Car, Baby, Gem, Star } from 'lucide-react'
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
  { key: 'idol', label: '明星偶像', icon: Star },
  { key: 'other', label: '其他', icon: MoreHorizontal },
]

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b py-20 md:py-28">
          <div className="mx-auto max-w-2xl px-4 text-center">
            <h1 className="font-heading text-4xl font-bold text-foreground md:text-5xl leading-tight">
              找到最適合你的日本代購
            </h1>
            <p className="mt-4 text-base text-muted-foreground">
              比較多家代購的價格、評價、運送速度，一次搞定
            </p>
            <div className="mt-8 mx-auto max-w-xl">
              <HomeSearchBar />
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="mx-auto max-w-7xl px-4 py-14">
          <h2 className="font-heading text-lg font-semibold mb-5 text-foreground">商品分類</h2>
          <div className="grid grid-cols-5 gap-1 md:grid-cols-8">
            {categories.map((cat) => {
              const Icon = cat.icon
              return (
                <Link
                  key={cat.key}
                  href={`/search?category=${cat.key}`}
                  className="flex flex-col items-center gap-2 rounded-md p-3 transition-colors hover:bg-muted"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs text-center text-muted-foreground leading-tight">{cat.label}</span>
                </Link>
              )
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t bg-foreground">
          <div className="mx-auto max-w-2xl px-4 py-16 text-center md:py-20">
            <h2 className="font-heading text-2xl font-bold text-background md:text-3xl">成為 Kozukase 賣家</h2>
            <p className="mt-3 text-sm text-background/60">讓更多買家找到你的代購服務</p>
            <Button
              size="lg"
              className="mt-8 bg-background text-foreground hover:bg-background/90"
              render={<Link href="/become-seller" />}
            >
              立即上架
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
