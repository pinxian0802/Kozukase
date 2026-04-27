export function getThumbnailUrl(image) {
  if (!image) return null
  return image.thumbnail_url ?? image.thumbnailUrl ?? image.url ?? null
}

export function getDetailImageUrl(image) {
  if (!image) return null
  return image.url ?? image.thumbnail_url ?? image.thumbnailUrl ?? null
}

export function getCardImageUrl(record) {
  if (!record) return null

  return (
    getThumbnailUrl(record.catalog_image) ??
    record.catalog_thumbnail_url ??
    record.catalogThumbnailUrl ??
    record.catalog_image_url ??
    getThumbnailUrl(record.product_images?.[0]) ??
    getThumbnailUrl(record.images?.[0]) ??
    null
  )
}
