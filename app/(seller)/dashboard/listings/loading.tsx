import { Skeleton } from '@/components/ui/skeleton'

export default function ListingsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Skeleton className="h-8 w-48 mb-6" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-video w-full rounded-xl" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/4" />
          </div>
        ))}
      </div>
    </div>
  )
}
