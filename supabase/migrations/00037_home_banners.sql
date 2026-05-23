-- 00037_home_banners.sql
-- 首頁頂部橫式 banner 輪播,由 admin 後台管理

create table public.home_banners (
  id            uuid        primary key default gen_random_uuid(),
  image_url     text        not null,
  image_r2_key  text        not null,
  link_url      text,
  is_active     boolean     not null default true,
  sort_order    integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid        references auth.users(id) on delete set null
);

-- 首頁查詢:上架 + 依順序
create index home_banners_active_order_idx
  on public.home_banners (is_active, sort_order);

-- 沿用既有 set_updated_at() 觸發器函式維護 updated_at
create trigger home_banners_set_updated_at
  before update on public.home_banners
  for each row execute function public.set_updated_at();

-- RLS:新表會被 rls_auto_enable() event trigger 自動 enable,此處顯式 enable 求明確
alter table public.home_banners enable row level security;

-- 公開讀取「已上架」banner(縱深防禦;實際讀取走 service role)。
-- 不建立 write policy:寫入一律經 service role + adminProcedure。
create policy "home_banners_public_read_active"
  on public.home_banners
  for select
  to anon, authenticated
  using (is_active = true);
