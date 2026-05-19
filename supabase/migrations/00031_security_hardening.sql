-- 1. 撤銷 rls_auto_enable() 對 anon/authenticated 的執行權限
--    此函數為開發工具，不應透過公開 API 呼叫
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;

-- 2. 固定所有函數的 search_path，防止 schema 注入攻擊
ALTER FUNCTION public.check_connection_image_limit()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.check_connection_limit()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.check_listing_image_limit()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.check_listing_limit()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.check_wish_limit()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.katakana_to_hiragana(t text)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.products_search_text_update()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.replace_connection_images(p_connection_id uuid, p_images jsonb)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.replace_listing_images(p_listing_id uuid, p_images jsonb)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.search_product_ids(search_query text)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.search_products(search_query text, result_limit integer)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.set_updated_at()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.update_review_like_count()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.update_seller_follow_count()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.update_seller_review_stats()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.update_wish_count()
  SET search_path = public, pg_catalog;
