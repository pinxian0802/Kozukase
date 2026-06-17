import { ListingResultCard, type ListingResultCardData } from '@/components/listing/listing-result-card'

interface ListingComparisonProps {
  listings: ListingResultCardData[]
  /** 桌機（lg 以上）欄數。搜尋頁用 4 欄，商品詳情比價維持 3 欄。 */
  columns?: 3 | 4
}

export function ListingComparison({ listings, columns = 3 }: ListingComparisonProps) {
  if (listings.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">目前沒有符合條件的代購</p>
    )
  }

  const gridClass =
    columns === 4
      ? 'grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-4 lg:grid-cols-4'
      : 'grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-4'

  return (
    <div className={gridClass}>
      {listings.map((listing) => (
        <ListingResultCard key={listing.id} listing={listing} />
      ))}
    </div>
  )
}
