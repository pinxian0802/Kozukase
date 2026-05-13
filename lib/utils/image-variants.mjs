export function getThumbnailUrl(image) {
  if (!image) return null
  return image.thumbnail_url ?? image.url ?? null
}

export function getCardImageUrl(record) {
  if (!record) return null

  return (
    getThumbnailUrl(record.catalog_image) ??
    record.catalog_image_url ??
    getThumbnailUrl(record.product_images?.[0]) ??
    null
  )
}
