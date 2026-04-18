import Link from 'next/link'
import { ArrowRight, Package, Shield, Users, Flag, Globe } from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const adminCards = [
  {
    href: '/admin/users',
    title: '使用者管理',
    description: '查看所有帳號並指派或取消管理員權限。',
    icon: Users,
  },
  {
    href: '/admin/products',
    title: '商品管理',
    description: '搜尋商品、編輯名稱品牌分類與封面圖片。',
    icon: Package,
  },
  {
    href: '/admin/listings',
    title: '代購審核',
    description: '處理被下架後重新申請的代購項目。',
    icon: Flag,
  },
  {
    href: '/admin/connections',
    title: '連線審核',
    description: '處理被結束後重新申請的連線公告。',
    icon: Globe,
  },
]

export default function AdminHomePage() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Shield className="h-3.5 w-3.5" />
          管理後台入口
        </div>
        <h1 className="text-3xl font-bold font-heading">管理後台總覽</h1>
        <p className="max-w-2xl text-muted-foreground">
          從這裡直接進入使用者、商品與審核功能。你可以先管理帳號權限，再處理商品與後台審核作業。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {adminCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.href} className="border-foreground/10 shadow-sm">
              <CardHeader>
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle>{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                點擊進入對應管理頁面。
              </CardContent>
              <CardFooter>
                <Button render={<Link href={card.href} />} className="w-full">
                  {card.title}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
