-- 賣家後台數據總覽：把原本 analytics.getSellerStats 的 22 支 count 查詢
-- 合併為單一函式呼叫。視窗邊界由呼叫端傳入，與原 TS 行為一致：
--   current  = dateField >= p_cur_start
--   previous = p_prev_start <= dateField < p_cur_start
create or replace function public.seller_dashboard_stats(
  p_seller_id uuid,
  p_cur_start timestamptz,
  p_prev_start timestamptz
)
returns table (
  listing_views_cur bigint, listing_views_prev bigint,
  profile_views_cur bigint, profile_views_prev bigint,
  ig_clicks_cur bigint, ig_clicks_prev bigint,
  threads_clicks_cur bigint, threads_clicks_prev bigint,
  inquiries_cur bigint, inquiries_prev bigint,
  bookmarks_cur bigint, bookmarks_prev bigint,
  followers_cur bigint, followers_prev bigint,
  wish_matches_cur bigint, wish_matches_prev bigint,
  product_views_cur bigint, product_views_prev bigint,
  connection_views_cur bigint, connection_views_prev bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with my_listings as (
    select id, product_id from listings where seller_id = p_seller_id
  ),
  my_products as (
    select distinct product_id from my_listings where product_id is not null
  ),
  my_connections as (
    select id from connections where seller_id = p_seller_id
  )
  select
    (select count(*) from listing_views v where v.listing_id in (select id from my_listings) and v.viewed_at >= p_cur_start),
    (select count(*) from listing_views v where v.listing_id in (select id from my_listings) and v.viewed_at >= p_prev_start and v.viewed_at < p_cur_start),

    (select count(*) from profile_views v where v.seller_id = p_seller_id and v.viewed_at >= p_cur_start),
    (select count(*) from profile_views v where v.seller_id = p_seller_id and v.viewed_at >= p_prev_start and v.viewed_at < p_cur_start),

    (select count(*) from social_link_clicks c where c.seller_id = p_seller_id and c.platform = 'ig' and c.clicked_at >= p_cur_start),
    (select count(*) from social_link_clicks c where c.seller_id = p_seller_id and c.platform = 'ig' and c.clicked_at >= p_prev_start and c.clicked_at < p_cur_start),

    (select count(*) from social_link_clicks c where c.seller_id = p_seller_id and c.platform = 'threads' and c.clicked_at >= p_cur_start),
    (select count(*) from social_link_clicks c where c.seller_id = p_seller_id and c.platform = 'threads' and c.clicked_at >= p_prev_start and c.clicked_at < p_cur_start),

    (select count(*) from conversations x where x.seller_id = p_seller_id and x.created_at >= p_cur_start),
    (select count(*) from conversations x where x.seller_id = p_seller_id and x.created_at >= p_prev_start and x.created_at < p_cur_start),

    (select count(*) from listing_bookmarks b where b.listing_id in (select id from my_listings) and b.created_at >= p_cur_start),
    (select count(*) from listing_bookmarks b where b.listing_id in (select id from my_listings) and b.created_at >= p_prev_start and b.created_at < p_cur_start),

    (select count(*) from follows f where f.seller_id = p_seller_id and f.created_at >= p_cur_start),
    (select count(*) from follows f where f.seller_id = p_seller_id and f.created_at >= p_prev_start and f.created_at < p_cur_start),

    (select count(*) from wishes w where w.product_id in (select product_id from my_products) and w.created_at >= p_cur_start),
    (select count(*) from wishes w where w.product_id in (select product_id from my_products) and w.created_at >= p_prev_start and w.created_at < p_cur_start),

    (select count(*) from product_views v where v.product_id in (select product_id from my_products) and v.viewed_at >= p_cur_start),
    (select count(*) from product_views v where v.product_id in (select product_id from my_products) and v.viewed_at >= p_prev_start and v.viewed_at < p_cur_start),

    (select count(*) from connection_views v where v.connection_id in (select id from my_connections) and v.viewed_at >= p_cur_start),
    (select count(*) from connection_views v where v.connection_id in (select id from my_connections) and v.viewed_at >= p_prev_start and v.viewed_at < p_cur_start)
$$;

-- 僅允許 service_role（tRPC 後端）呼叫；不開放 anon / authenticated 直接 RPC
revoke all on function public.seller_dashboard_stats(uuid, timestamptz, timestamptz) from public;
revoke all on function public.seller_dashboard_stats(uuid, timestamptz, timestamptz) from anon;
revoke all on function public.seller_dashboard_stats(uuid, timestamptz, timestamptz) from authenticated;
grant execute on function public.seller_dashboard_stats(uuid, timestamptz, timestamptz) to service_role;
