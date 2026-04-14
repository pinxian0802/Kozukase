'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { trpc } from '@/lib/trpc/client'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { data: session, isLoading } = trpc.auth.getSession.useQuery()

  useEffect(() => {
    if (!isLoading && !session?.isAdmin) {
      router.push('/')
    }
  }, [isLoading, session, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-32 w-32 rounded-xl" />
      </div>
    )
  }

  if (!session?.isAdmin) return null

  return (
    <>
      <Header />
      <div className="flex flex-1">
        <Sidebar mode="admin" />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </>
  )
}
