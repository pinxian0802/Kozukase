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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">{title}</h1>
          <p className="text-sm text-muted-foreground">{usageHint}</p>
        </div>
        <Button render={<Link href={newButton.href} />}>
          <Plus className="mr-1 h-4 w-4" />
          {newButton.label}
        </Button>
      </div>

      <Tabs value={currentTab} onValueChange={onTabChange}>
        <FilterTabsList items={tabs} />
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
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
