# Product image fallback

Some older products only have rows in `product_images` and never got `products.catalog_image_id` set.

## Symptom
- Product cards show the empty placeholder even though the product has uploaded images.
- Seller/admin lists and the product detail page may show no image for those older records.

## Fix
- Query `product_images` alongside `catalog_image`.
- Render `catalog_image.url ?? product_images[0].url` in the UI.
- When a new product image is confirmed, backfill `products.catalog_image_id` if it is still null.

## Result
- New uploads keep working.
- Existing records with missing `catalog_image_id` still display an image.
