'use client'

import Link from 'next/link'
import { Package, Globe, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { trpc } from '@/lib/trpc/client'

export default function SellerDashboardPage() {
  const { data: counts, isLoading } = trpc.listing.myListingCount.useQuery()
  const { data: connections } = trpc.connection.myConnections.useQuery({})

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading">賣家後台</h1>
        <div className="flex gap-2">
          <Button size="sm" render={<Link href="/dashboard/listings/new" />}>
            <Plus className="mr-1 h-4 w-4" />新增代購
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/dashboard/connections/new" />}>
            <Globe className="mr-1 h-4 w-4" />新增連線
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">全部代購</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{counts?.total ?? 0}<span className="text-sm text-muted-foreground font-normal"> / 25</span></p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">上架中</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-green-600">{counts?.active ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">草稿</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-yellow-600">{counts?.draft ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">待審核</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-blue-600">{counts?.pending_approval ?? 0}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">最近連線</CardTitle>
              <Button variant="ghost" size="sm" render={<Link href="/dashboard/connections" />}>全部</Button>
            </div>
          </CardHeader>
          <CardContent>
            {connections && connections.length > 0 ? (
              <div className="space-y-3">
                {connections.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <p className="font-medium">{c.region?.name}{c.sub_region ? ` - ${c.sub_region}` : ''}</p>
                      <p className="text-xs text-muted-foreground">{c.start_date} ~ {c.end_date}</p>
                    </div>
                    <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>{c.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">還沒有連線公告</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
