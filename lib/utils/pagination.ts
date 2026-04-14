export function encodeCursor(id: string, sortValue?: string | number): string {
  const payload = sortValue !== undefined ? `${id}:${sortValue}` : id
  return Buffer.from(payload).toString('base64')
}

export function decodeCursor(cursor: string): { id: string; sortValue?: string } {
  const decoded = Buffer.from(cursor, 'base64').toString('utf-8')
  const parts = decoded.split(':')
  return {
    id: parts[0],
    sortValue: parts.length > 1 ? parts.slice(1).join(':') : undefined,
  }
}

export type PaginatedResult<T> = {
  items: T[]
  nextCursor: string | null
}

export function paginateResults<T extends { id: string }>(
  items: T[],
  limit: number,
  getSortValue?: (item: T) => string | number
): PaginatedResult<T> {
  const hasMore = items.length > limit
  const sliced = hasMore ? items.slice(0, limit) : items
  const lastItem = sliced[sliced.length - 1]

  return {
    items: sliced,
    nextCursor: hasMore && lastItem
      ? encodeCursor(lastItem.id, getSortValue?.(lastItem))
      : null,
  }
}
