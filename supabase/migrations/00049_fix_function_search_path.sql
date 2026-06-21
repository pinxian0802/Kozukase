-- 上線前安全強化:為兩個遺漏的函式鎖定 search_path,
-- 消除 advisor 的 function_search_path_mutable 警告(防 search_path 劫持的縱深防禦)。
-- 兩者皆為 SECURITY INVOKER,風險本就較低,此處為求一致與通過 linter。
ALTER FUNCTION public.popular_products(result_limit integer, days_window integer)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.sync_connections_locations_text()
  SET search_path = public, pg_catalog;
