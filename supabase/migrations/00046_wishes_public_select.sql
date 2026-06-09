-- 許願榜（wishes）是公開展示用的資料，讀取權限應與 connections / listings / products
-- 等公開瀏覽表一致（任何登入者皆可讀），而非沿用 owner-only 的設定。
--
-- 背景：原本 wishes_select_own 限制 auth.uid() = user_id，僅因後端統一以 service role
-- 查詢才讓許願榜看得到所有人的願。一旦有 API 改用使用者身分查 wishes，公開許願榜會
-- 只剩自己的願。此 migration 把 RLS 對齊其公開瀏覽的兄弟表，讓 RLS 成為正確的安全網。
--
-- insert / delete 維持 owner-only（只能建立 / 刪除自己的許願），不在此調整。

DROP POLICY IF EXISTS "wishes_select_own" ON wishes;

CREATE POLICY "wishes_select_authenticated"
  ON wishes FOR SELECT
  TO authenticated
  USING (true);
