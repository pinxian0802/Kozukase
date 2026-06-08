'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Tabs } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FilterTabsList } from '@/components/shared/filter-tabs-list'
import { EmptyState } from '@/components/shared/empty-state'

export type DashboardListShellTab = {
  value: string
  label: string
  count: number
}

export type DashboardListShellProps = {
  title: string
  usageHint: string
  newButton: {
    href: string
    label: string
  }
  tabs: DashboardListShellTab[]
  currentTab: string
  onTabChange: (value: string) => void
  isLoading: boolean
  isEmpty: boolean
  emptyState: {
    icon: LucideIcon
    title: string
    description: string
  }
  children: ReactNode
}

export function DashboardListShell({
  title,
  usageHint,
  newButton,
  tabs,
  currentTab,
  onTabChange,
  isLoading,
  isEmpty,
  emptyState,
  children,
}: DashboardListShellProps) {
  return (
    <div className="space-y-3 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-bold font-heading md:text-2xl">{title}</h1>
          <p className="text-[11px] text-muted-foreground md:text-sm">{usageHint}</p>
        </div>
        <Button variant="cta-outline" size="xs" render={<Link href={newButton.href} />}>
          <Plus className="mr-0.5 h-2.5 w-2.5 md:mr-1 md:h-3.5 md:w-3.5" />
          {newButton.label}
        </Button>
      </div>

      <Tabs value={currentTab} onValueChange={onTabChange}>
        <FilterTabsList items={tabs} />
      </Tabs>

      {isLoading ? (
        <div className="space-y-1.5 md:space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[68px] rounded-lg md:h-16" />
          ))}
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={emptyState.icon}
          title={emptyState.title}
          description={emptyState.description}
        />
      ) : (
        children
      )}
    </div>
  )
}
