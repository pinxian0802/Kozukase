-- Add fallback image lookup so older products without catalog_image_id still return an image URL.
-- NOTE: categories is text[] because the client passes string values from the UI.
CREATE OR REPLACE FUNCTION public.search_products(search_query text, categories text[] DEFAULT NULL::text[])
RETURNS TABLE(
  id uuid,
  name text,
  brand text,
  category text,
  model_number text,
  catalog_image_url text,
  wish_count integer,
  listing_count integer
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id,
    p.name,
    p.brand,
    p.category,
    p.model_number,
    COALESCE(catalog_image.url, fallback_image.url) AS catalog_image_url,
    p.wish_count,
    COUNT(l.id)::int AS listing_count
  FROM products p
  LEFT JOIN product_images catalog_image ON catalog_image.id = p.catalog_image_id
  LEFT JOIN LATERAL (
    SELECT url
    FROM product_images
    WHERE product_id = p.id
    ORDER BY created_at ASC, id ASC
    LIMIT 1
  ) fallback_image ON TRUE
  LEFT JOIN listings l ON l.product_id = p.id
  WHERE p.is_removed = false
    AND (search_query IS NULL OR search_query = '' OR p.name ILIKE '%' || search_query || '%' OR COALESCE(p.brand, '') ILIKE '%' || search_query || '%' OR COALESCE(p.model_number, '') ILIKE '%' || search_query || '%')
    AND (categories IS NULL OR cardinality(categories) = 0 OR p.category::text = ANY(categories))
  GROUP BY p.id, p.name, p.brand, p.category, p.model_number, catalog_image.url, fallback_image.url, p.wish_count
  ORDER BY p.wish_count DESC, p.created_at DESC
$$;
