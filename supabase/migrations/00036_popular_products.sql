-- Migration 00036: popular_products RPC（首頁「熱門商品」用）
CREATE OR REPLACE FUNCTION public.popular_products(
  result_limit integer DEFAULT 12,
  days_window  integer DEFAULT 90
)
RETURNS TABLE (
  id                uuid,
  name              text,
  brand             text,
  category          text,
  model_number      text,
  catalog_image_url text,
  wish_count        integer,
  view_count        bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id,
    p.name,
    b.name AS brand,
    p.category::text,
    p.model_number,
    COALESCE(catalog_img.url, fallback_img.url) AS catalog_image_url,
    p.wish_count,
    COALESCE(v.view_count, 0) AS view_count
  FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN product_images catalog_img ON catalog_img.id = p.catalog_image_id
  LEFT JOIN LATERAL (
    SELECT img2.url
    FROM product_images img2
    WHERE img2.product_id = p.id
    ORDER BY img2.created_at ASC, img2.id ASC
    LIMIT 1
  ) fallback_img ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::bigint AS view_count
    FROM product_views pv
    WHERE pv.product_id = p.id
      AND pv.viewed_at >= now() - make_interval(days => days_window)
  ) v ON TRUE
  WHERE p.is_removed = false
    AND EXISTS (
      SELECT 1 FROM listings la
      WHERE la.product_id = p.id AND la.status = 'active'
    )
  ORDER BY COALESCE(v.view_count, 0) DESC, p.created_at DESC
  LIMIT result_limit;
$$;
