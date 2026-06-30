-- 代購搜尋與商品搜尋脫鉤。
-- 在此之前，代購（listings）搜尋是「先用關鍵字比對 products → 再用 product_id 反查 listings」，
-- 代購自己的 title 從未被搜尋，導致標題含關鍵字但商品不含時搜不到。
--
-- 新做法：代購搜尋 = 代購標題 OR 連結商品（名稱/別名）OR 品牌名 的聯集（使用者選擇「標題 + 商品/品牌」）。
-- 商品分頁的 search_product_ids 維持不變。

-- 代購標題模糊比對用的 GIN trigram 索引（與查詢一致先做 katakana→hiragana 正規化）。
-- katakana_to_hiragana 為 IMMUTABLE，可建立表達式索引。
CREATE INDEX IF NOT EXISTS idx_listings_title_trgm
  ON public.listings
  USING gin (public.katakana_to_hiragana(lower(title)) gin_trgm_ops);

-- 回傳符合關鍵字的 listing id；狀態/賣家停權等過濾由呼叫端 browse query 負責。
CREATE OR REPLACE FUNCTION public.search_listing_ids(search_query text)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT DISTINCT l.id
  FROM listings l
  JOIN products p ON p.id = l.product_id
  LEFT JOIN brands b ON b.id = p.brand_id
  WHERE p.is_removed = false
    AND (
      -- 代購標題
      public.katakana_to_hiragana(lower(l.title)) % public.katakana_to_hiragana(lower(search_query))
      OR public.katakana_to_hiragana(lower(l.title)) ILIKE '%' || public.katakana_to_hiragana(lower(search_query)) || '%'
      -- 連結商品（名稱 / 別名）
      OR p.search_text % public.katakana_to_hiragana(lower(search_query))
      OR p.search_text ILIKE '%' || public.katakana_to_hiragana(lower(search_query)) || '%'
      -- 品牌
      OR public.katakana_to_hiragana(lower(COALESCE(b.name, ''))) ILIKE '%' || public.katakana_to_hiragana(lower(search_query)) || '%'
    )
  LIMIT 500;
$$;

GRANT EXECUTE ON FUNCTION public.search_listing_ids(text) TO anon, authenticated, service_role;
