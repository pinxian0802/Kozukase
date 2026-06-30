-- 連線（connections）搜尋補上品牌比對，並對齊片假名→平假名正規化。
-- 在此之前 connection.browse 的全站搜尋僅對 title / description / locations_text 做裸 ILIKE，
-- 不比對連線掛的品牌（connection_brands → brands.name），也未做片假名正規化，
-- 與 product / listing 搜尋不一致：搜品牌名找不到連線、片假名與平假名無法互通。
--
-- 新做法：連線搜尋 = 標題 / 描述 / 地點文字 / 品牌名 的聯集，全部套用 katakana→hiragana。

CREATE OR REPLACE FUNCTION public.search_connection_ids(search_query text)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT DISTINCT c.id
  FROM connections c
  LEFT JOIN connection_brands cb ON cb.connection_id = c.id
  LEFT JOIN brands b ON b.id = cb.brand_id
  WHERE
    public.katakana_to_hiragana(lower(c.title)) % public.katakana_to_hiragana(lower(search_query))
    OR public.katakana_to_hiragana(lower(c.title)) ILIKE '%' || public.katakana_to_hiragana(lower(search_query)) || '%'
    OR public.katakana_to_hiragana(lower(COALESCE(c.description, ''))) ILIKE '%' || public.katakana_to_hiragana(lower(search_query)) || '%'
    OR public.katakana_to_hiragana(lower(COALESCE(c.locations_text, ''))) ILIKE '%' || public.katakana_to_hiragana(lower(search_query)) || '%'
    OR public.katakana_to_hiragana(lower(COALESCE(b.name, ''))) ILIKE '%' || public.katakana_to_hiragana(lower(search_query)) || '%'
  LIMIT 500;
$$;

GRANT EXECUTE ON FUNCTION public.search_connection_ids(text) TO anon, authenticated, service_role;

-- 連線標題模糊比對用的 GIN trigram 索引（與查詢一致先做 katakana→hiragana 正規化）
CREATE INDEX IF NOT EXISTS idx_connections_title_trgm
  ON public.connections
  USING gin (public.katakana_to_hiragana(lower(title)) gin_trgm_ops);
