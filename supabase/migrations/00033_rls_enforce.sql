-- 問題 2 修正：把線上「靠手動 event trigger 啟用 RLS」的機制納入 migration。
--
-- 背景：tRPC 走 service role 會繞過 RLS；但前端 Realtime 用公開的 anon key
-- 直接連 DB，該路徑安全完全依賴 RLS。先前 RLS 是靠線上手動建立、未進
-- migration 的 event trigger 自動啟用，從 migration 重建環境時不存在 →
-- 多數 public 表「有 policy 但 RLS 未啟用」→ 隱私資料全表可讀寫。
--
-- 本檔做兩件事，缺一不可：
--   (A) 重建 rls_auto_enable() + event trigger（未來新表自動開 RLS）
--   (B) 對目前所有 public 表顯式 ENABLE RLS（不依賴自動機關，重建即正確）

-- ---------------------------------------------------------------------------
-- (A) 自動啟用機關（與線上定義一致）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

-- rls_auto_enable() 為開發工具，不應透過公開 API 呼叫。
-- 注意：函式預設對 PUBLIC 授予 EXECUTE，僅 REVOKE FROM anon/authenticated
-- 無效（仍透過 PUBLIC 繼承），必須一併從 PUBLIC 收回。
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

DROP EVENT TRIGGER IF EXISTS ensure_rls;
CREATE EVENT TRIGGER ensure_rls
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();

-- ---------------------------------------------------------------------------
-- (B) 對目前所有 public 表顯式啟用 RLS（idempotent；已啟用者為 no-op）
-- ---------------------------------------------------------------------------
ALTER TABLE public.brands               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connection_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connection_brands    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connection_images    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_bookmarks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_images       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_views        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_bookmarks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_views        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_likes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_regions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_link_clicks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_tokens        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishes               ENABLE ROW LEVEL SECURITY;
