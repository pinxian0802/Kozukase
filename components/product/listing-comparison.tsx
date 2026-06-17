import { ListingResultCard, type ListingResultCardData } from '@/components/listing/listing-result-card'

interface ListingComparisonProps {
  listings: ListingResultCardData[]
}

export function ListingComparison({ listings }: ListingComparisonProps) {
  if (listings.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">目前沒有符合條件的代購</p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-4">
      {listings.map((listing) => (
        <ListingResultCard key={listing.id} listing={listing} />
      ))}
    </div>
  )
}
