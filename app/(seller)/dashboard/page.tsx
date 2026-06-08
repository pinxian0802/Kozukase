'use client'

import Link from 'next/link'
import { Package, Globe, Plus, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { trpc } from '@/lib/trpc/client'
import { AnalyticsStats } from '@/components/seller/analytics-stats'
import { DashboardHomeSkeleton } from '@/components/dashboard/home-skeleton'
import { DashboardStatusDot } from '@/components/dashboard/status-dot'

const MAX_LISTINGS = 25

function getGreeting() {
  const h = new Date().getHours()
  if (h < 5) return '深夜好'
  if (h < 12) return '早安'
  if (h < 18) return '午安'
  return '晚安'
}

const listingStatusConfig: Record<string, { label: string; dot: string }> = {
  active:           { label: '上架中', dot: 'bg-green-500' },
  draft:            { label: '草稿',   dot: 'bg-muted-foreground/40' },
  pending_approval: { label: '待審核', dot: 'bg-amber-400' },
  inactive:         { label: '已下架', dot: 'bg-red-400' },
}

const connectionStatusConfig: Record<string, { label: string; dot: string }> = {
  active:           { label: '連線中', dot: 'bg-green-500' },
  pending_approval: { label: '待審核', dot: 'bg-amber-400' },
  ended:            { label: '已結束', dot: 'bg-muted-foreground/40' },
}

export default function SellerDashboardPage() {
  const { data: counts, isLoading } = trpc.listing.myListingCount.useQuery()
  const { data: connections } = trpc.connection.myConnections.useQuery({})
  const { data: recentListings } = trpc.listing.myListings.useQuery({ limit: 5 })

  const total = counts?.total ?? 0
  const active = counts?.active ?? 0
  const draft = counts?.draft ?? 0
  const pending = counts?.pending_approval ?? 0
  const inactive = counts?.inactive ?? 0
  const remaining = MAX_LISTINGS - total

  const recentConnections = connections?.slice(0, 5) ?? []

  const today = new Date().toLocaleDateString('zh-TW', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  if (isLoading) {
    return <DashboardHomeSkeleton />
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-bold font-heading md:text-2xl">{getGreeting()}，歡迎回來</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5 md:text-sm">{today}</p>
        </div>
        <div className="flex gap-1.5 shrink-0 md:gap-2">
          <Button variant="cta-outline" size="sm" render={<Link href="/dashboard/listings/new" />}>
            <Plus className="mr-0.5 h-2.5 w-2.5 md:mr-1 md:h-4 md:w-4" />代購
          </Button>
          <Button variant="cta-outline" size="sm" render={<Link href="/dashboard/connections/new" />}>
            <Globe className="mr-0.5 h-3 w-3 md:mr-1 md:h-4 md:w-4" />連線
          </Button>
        </div>
      </div>

      {/* Analytics */}
      <AnalyticsStats />

      {/* Listing quota overview */}
      <Card className="ring-0 shadow-sm bg-white">
        <CardContent className="pt-3 pb-3 md:pt-5 md:pb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium md:text-sm">代購刊登量</span>
            <span className="text-xs tabular-nums md:text-sm">
              <span className="font-bold">{total}</span>
              <span className="text-muted-foreground"> / {MAX_LISTINGS}</span>
            </span>
          </div>

          {/* Segmented progress bar */}
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden flex">
            {active > 0 && (
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${(active / MAX_LISTINGS) * 100}%` }}
              />
            )}
            {pending > 0 && (
              <div
                className="h-full bg-amber-400 transition-all"
                style={{ width: `${(pending / MAX_LISTINGS) * 100}%` }}
              />
            )}
            {draft > 0 && (
              <div
                className="h-full bg-blue-400 transition-all"
                style={{ width: `${(draft / MAX_LISTINGS) * 100}%` }}
              />
            )}
            {inactive > 0 && (
              <div
                className="h-full bg-red-400 transition-all"
                style={{ width: `${(inactive / MAX_LISTINGS) * 100}%` }}
              />
            )}
          </div>

          {/* Legend */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground md:mt-3 md:gap-x-5 md:gap-y-1.5 md:text-xs">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-sm md:h-2 md:w-2 bg-green-500" />
              上架中 <strong className="text-foreground">{active}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-sm md:h-2 md:w-2 bg-amber-400" />
              待審核 <strong className="text-foreground">{pending}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-sm md:h-2 md:w-2 bg-blue-400" />
              草稿 <strong className="text-foreground">{draft}</strong>
            </span>
            {inactive > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-sm md:h-2 md:w-2 bg-red-400" />
                已下架 <strong className="text-foreground">{inactive}</strong>
              </span>
            )}
            <span className="ml-auto">
              剩餘 <span className="font-semibold text-foreground">{remaining}</span> 個空位
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Recent listings + Active connections */}
      <div className="grid gap-3 md:gap-6 lg:grid-cols-[3fr_2fr]">
        {/* Recent listings */}
        <Card className="ring-0 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">最近代購</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground"
                render={<Link href="/dashboard/listings" />}
              >
                全部 <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-2">
            {recentListings && recentListings.items.length > 0 ? (
              <div className="divide-y divide-border -mx-4 md:-mx-6">
                {recentListings.items.map((l: any) => {
                  const sc = listingStatusConfig[l.status] ?? { label: l.status, dot: 'bg-muted-foreground/40' }
                  return (
                    <Link
                      key={l.id}
                      href={`/dashboard/listings/${l.id}/edit`}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors md:px-6 md:py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{l.title ?? l.product?.name ?? '未知商品'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {l.product?.name ?? ''}
                          {l.price != null
                            ? `・NT$ ${l.price.toLocaleString()}`
                            : l.is_price_on_request
                            ? '・私訊報價'
                            : ''}
                        </p>
                      </div>
                      <DashboardStatusDot
                        label={sc.label}
                        dotClassName={sc.dot}
                        className="ml-3 shrink-0"
                        warning={l.inactive_reason === 'admin' ? (l.admin_note || '此代購已被管理員下架') : null}
                      />
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="py-10 flex flex-col items-center text-center gap-2">
                <Package className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">還沒有代購</p>
                <Button
                  variant="cta-outline"
                  size="default"
                  className="mt-1"
                  render={<Link href="/dashboard/listings/new" />}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />新增第一筆代購
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active connections */}
        <Card className="ring-0 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">目前連線</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground"
                render={<Link href="/dashboard/connections" />}
              >
                全部 <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-2">
            {recentConnections.length > 0 ? (
              <div className="divide-y divide-border -mx-4 md:-mx-6">
                {recentConnections.map((c: any) => {
                  const cs = connectionStatusConfig[c.status] ?? { label: c.status, dot: 'bg-muted-foreground/40' }
                  return (
                    <Link
                      key={c.id}
                      href={`/dashboard/connections/${c.id}/edit`}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors md:px-6 md:py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{c.title ?? c.region?.name ?? '未知地區'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {c.region?.name ?? ''}・至 {c.end_date}
                        </p>
                      </div>
                      <DashboardStatusDot
                        label={cs.label}
                        dotClassName={cs.dot}
                        className="ml-3 shrink-0"
                        warning={c.ended_reason === 'admin' ? (c.admin_note || '此連線已被管理員中止') : null}
                      />
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="py-10 flex flex-col items-center text-center gap-2">
                <Globe className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">沒有進行中的連線</p>
                <Button
                  variant="cta-outline"
                  size="default"
                  className="mt-1"
                  render={<Link href="/dashboard/connections/new" />}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />新增連線
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
