-- Update search_products RPC to return model_number and catalog_image_url
DROP FUNCTION IF EXISTS search_products(text, product_category, integer, integer);

CREATE OR REPLACE FUNCTION search_products(
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
  catalog_image_url text,
  model_number text,
  wish_count integer,
  similarity_score real
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.brand,
    p.category,
    p.catalog_image_id,
    pi.url AS catalog_image_url,
    p.model_number,
    p.wish_count,
    similarity(p.search_text, lower(search_query)) AS similarity_score
  FROM products p
  LEFT JOIN product_images pi ON pi.id = p.catalog_image_id
  WHERE p.is_removed = false
    AND (category_filter IS NULL OR p.category = category_filter)
    AND (
      p.search_text % lower(search_query)
      OR p.search_text ILIKE '%' || search_query || '%'
    )
  ORDER BY similarity_score DESC, p.wish_count DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql STABLE;
