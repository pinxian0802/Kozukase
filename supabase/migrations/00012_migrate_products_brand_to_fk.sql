-- Migrate products.brand text to products.brand_id FK and refresh search RPCs.

ALTER TABLE products DROP COLUMN search_text;
ALTER TABLE products DROP COLUMN brand;

ALTER TABLE products
  ADD COLUMN brand_id uuid REFERENCES brands(id) ON DELETE SET NULL;

ALTER TABLE products
  ADD COLUMN search_text text GENERATED ALWAYS AS (lower(name)) STORED;

CREATE INDEX idx_products_brand_id ON products(brand_id);
CREATE INDEX idx_products_search_text ON products USING gin(search_text gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_products(
  search_query text,
  category_filter product_category DEFAULT NULL,
  result_limit integer DEFAULT 20,
  result_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  brand text,
  category product_category,
  catalog_image_id uuid,
  wish_count integer,
  similarity_score real
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    b.name AS brand,
    p.category,
    p.catalog_image_id,
    p.wish_count,
    similarity(p.search_text, lower(search_query)) AS similarity_score
  FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
  WHERE p.is_removed = false
    AND (category_filter IS NULL OR p.category = category_filter)
    AND (
      p.search_text % lower(search_query)
      OR p.search_text ILIKE '%' || search_query || '%'
      OR COALESCE(b.name, '') ILIKE '%' || search_query || '%'
    )
  ORDER BY similarity_score DESC, p.wish_count DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql STABLE;

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
    b.name AS brand,
    p.category,
    p.model_number,
    COALESCE(catalog_image.url, fallback_image.url) AS catalog_image_url,
    p.wish_count,
    COUNT(l.id)::int AS listing_count
  FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
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
    AND (search_query IS NULL OR search_query = '' OR p.name ILIKE '%' || search_query || '%' OR COALESCE(b.name, '') ILIKE '%' || search_query || '%' OR COALESCE(p.model_number, '') ILIKE '%' || search_query || '%')
    AND (categories IS NULL OR cardinality(categories) = 0 OR p.category::text = ANY(categories))
  GROUP BY p.id, p.name, b.name, p.category, p.model_number, catalog_image.url, fallback_image.url, p.wish_count
  ORDER BY p.wish_count DESC, p.created_at DESC
$$;