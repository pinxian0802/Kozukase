-- 商品型號（model_number）納入搜尋。
-- search_text 原本只含 name + aliases，型號搜不到。將 model_number 一併併入 search_text，
-- 商品搜尋（search_product_ids）與代購搜尋（search_listing_ids，含連結商品的 search_text）即自動可用型號搜尋。

-- 1. 更新 trigger 函式：search_text = katakana_to_hiragana(name + aliases + model_number)
CREATE OR REPLACE FUNCTION public.products_search_text_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  NEW.search_text := public.katakana_to_hiragana(
    lower(NEW.name) || ' ' ||
    lower(array_to_string(NEW.aliases, ' ')) || ' ' ||
    lower(COALESCE(NEW.model_number, ''))
  );
  RETURN NEW;
END;
$$;

-- 2. 重建 trigger，讓 model_number 變動時也重算 search_text
DROP TRIGGER IF EXISTS trg_products_search_text ON public.products;
CREATE TRIGGER trg_products_search_text
BEFORE INSERT OR UPDATE OF name, aliases, model_number
ON public.products
FOR EACH ROW
EXECUTE FUNCTION products_search_text_update();

-- 3. 回填既有資料
UPDATE products SET search_text = public.katakana_to_hiragana(
  lower(name) || ' ' ||
  lower(array_to_string(aliases, ' ')) || ' ' ||
  lower(COALESCE(model_number, ''))
);
