import { Skeleton } from '@/components/ui/skeleton'

export default function ListingsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Skeleton className="h-8 w-48 mb-6" />
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-[28px] border p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,2.4fr)_minmax(220px,1.3fr)_minmax(180px,1fr)_minmax(160px,0.9fr)_auto] lg:items-center">
              <div className="flex gap-4">
                <Skeleton className="h-24 w-24 rounded-2xl" />
                <div className="min-w-0 flex-1 space-y-3">
                  <Skeleton className="h-5 w-28 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-7 w-3/4" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-32 rounded-full" />
                    <Skeleton className="h-6 w-28 rounded-full" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-full" />
              </div>

              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>

              <div className="space-y-2 lg:justify-self-end">
                <Skeleton className="h-4 w-12 lg:ml-auto" />
                <Skeleton className="h-10 w-36 lg:ml-auto" />
                <Skeleton className="h-4 w-28 lg:ml-auto" />
              </div>

              <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
