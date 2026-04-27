-- Migration 00016: Fix search functionality
-- Bug 2: katakana_to_hiragana for search_text normalization
-- Bug 3: search_products uses deprecated p.brand field
-- Bug 4: search_product_ids has no LIMIT

-- ============================================================
-- 1. katakana_to_hiragana() helper function
-- ============================================================
CREATE OR REPLACE FUNCTION public.katakana_to_hiragana(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT
AS $$
  SELECT translate(
    t,
    'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴ',
    'ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔ'
  );
$$;

-- ============================================================
-- 2. Update trigger to also apply katakana_to_hiragana
--    so search_text stores hiragana-normalized text
-- ============================================================
CREATE OR REPLACE FUNCTION products_search_text_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_text := public.katakana_to_hiragana(
    lower(NEW.name) || ' ' || lower(array_to_string(NEW.aliases, ' '))
  );
  RETURN NEW;
END;
$$;

-- Backfill all existing rows
UPDATE products
SET search_text = public.katakana_to_hiragana(
  lower(name) || ' ' || lower(array_to_string(aliases, ' '))
);

-- ============================================================
-- 3. Fix search_products RPC (Bug 3: was using p.brand text field)
--    Drop all overloads and create a single clean one.
-- ============================================================
DROP FUNCTION IF EXISTS public.search_products(text, text[], text[]);
DROP FUNCTION IF EXISTS public.search_products(text, text[]);
DROP FUNCTION IF EXISTS public.search_products(text, product_category, integer, integer);

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
    COALESCE(catalog_img.url, fallback_img.url) AS catalog_image_url,
    p.wish_count,
    similarity(p.search_text, normalized) AS similarity_score
  FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN product_images catalog_img ON catalog_img.id = p.catalog_image_id
  LEFT JOIN LATERAL (
    SELECT img2.url FROM product_images img2
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

-- ============================================================
-- 4. Fix search_product_ids RPC
--    Bug 2: apply katakana_to_hiragana to query
--    Bug 4: add LIMIT 500
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_product_ids(search_query text)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT p.id
  FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
  WHERE p.is_removed = false
    AND (
      p.search_text % public.katakana_to_hiragana(lower(search_query))
      OR p.search_text ILIKE '%' || public.katakana_to_hiragana(lower(search_query)) || '%'
      OR katakana_to_hiragana(lower(COALESCE(b.name, ''))) ILIKE '%' || public.katakana_to_hiragana(lower(search_query)) || '%'
    )
  LIMIT 500;
$$;
