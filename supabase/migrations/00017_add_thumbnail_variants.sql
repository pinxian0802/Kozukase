ALTER TABLE product_images
  ADD COLUMN thumbnail_r2_key text,
  ADD COLUMN thumbnail_url text;

ALTER TABLE listing_images
  ADD COLUMN thumbnail_r2_key text,
  ADD COLUMN thumbnail_url text;

ALTER TABLE connection_images
  ADD COLUMN thumbnail_r2_key text,
  ADD COLUMN thumbnail_url text;

UPDATE product_images
SET
  thumbnail_r2_key = COALESCE(thumbnail_r2_key, r2_key),
  thumbnail_url = COALESCE(thumbnail_url, url)
WHERE thumbnail_r2_key IS NULL OR thumbnail_url IS NULL;

UPDATE listing_images
SET
  thumbnail_r2_key = COALESCE(thumbnail_r2_key, r2_key),
  thumbnail_url = COALESCE(thumbnail_url, url)
WHERE thumbnail_r2_key IS NULL OR thumbnail_url IS NULL;

UPDATE connection_images
SET
  thumbnail_r2_key = COALESCE(thumbnail_r2_key, r2_key),
  thumbnail_url = COALESCE(thumbnail_url, url)
WHERE thumbnail_r2_key IS NULL OR thumbnail_url IS NULL;

CREATE OR REPLACE FUNCTION replace_listing_images(
  p_listing_id uuid,
  p_images     jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM listing_images WHERE listing_id = p_listing_id;

  IF jsonb_array_length(p_images) > 0 THEN
    INSERT INTO listing_images (listing_id, r2_key, url, thumbnail_r2_key, thumbnail_url, sort_order)
    SELECT
      p_listing_id,
      (elem->>'r2_key')::text,
      (elem->>'url')::text,
      COALESCE((elem->>'thumbnail_r2_key')::text, (elem->>'r2_key')::text),
      COALESCE((elem->>'thumbnail_url')::text, (elem->>'url')::text),
      (elem->>'sort_order')::smallint
    FROM jsonb_array_elements(p_images) AS elem;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION replace_connection_images(
  p_connection_id uuid,
  p_images        jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM connection_images WHERE connection_id = p_connection_id;

  IF jsonb_array_length(p_images) > 0 THEN
    INSERT INTO connection_images (connection_id, r2_key, url, thumbnail_r2_key, thumbnail_url, sort_order)
    SELECT
      p_connection_id,
      (elem->>'r2_key')::text,
      (elem->>'url')::text,
      COALESCE((elem->>'thumbnail_r2_key')::text, (elem->>'r2_key')::text),
      COALESCE((elem->>'thumbnail_url')::text, (elem->>'url')::text),
      (elem->>'sort_order')::smallint
    FROM jsonb_array_elements(p_images) AS elem;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_products(
  search_query text,
  result_limit integer DEFAULT 20
)
RETURNS TABLE (
  id                uuid,
  name              text,
  brand             text,
  category          text,
  model_number      text,
  catalog_image_url text,
  wish_count        integer,
  similarity_score  real
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  normalized text := public.katakana_to_hiragana(lower(search_query));
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    b.name AS brand,
    p.category::text,
    p.model_number,
    COALESCE(
      catalog_img.thumbnail_url,
      catalog_img.url,
      fallback_img.thumbnail_url,
      fallback_img.url
    ) AS catalog_image_url,
    p.wish_count,
    similarity(p.search_text, normalized) AS similarity_score
  FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN product_images catalog_img ON catalog_img.id = p.catalog_image_id
  LEFT JOIN LATERAL (
    SELECT img2.url, img2.thumbnail_url
    FROM product_images img2
    WHERE img2.product_id = p.id
    ORDER BY img2.created_at ASC, img2.id ASC
    LIMIT 1
  ) fallback_img ON TRUE
  WHERE p.is_removed = false
    AND (
      p.search_text % normalized
      OR p.search_text ILIKE '%' || normalized || '%'
      OR katakana_to_hiragana(lower(COALESCE(b.name, ''))) ILIKE '%' || normalized || '%'
    )
  ORDER BY similarity_score DESC, p.wish_count DESC
  LIMIT result_limit;
END;
$$;
