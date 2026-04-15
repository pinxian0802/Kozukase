import { Skeleton } from '@/components/ui/skeleton'

export default function ConnectionsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Skeleton className="h-8 w-40 mb-3" />
      <Skeleton className="h-5 w-72 mb-8" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
