-- 賣家可標示是否提供購買證明 / 明細（供買家辨別正品）。
-- 比照 is_social_verified，作為 search 篩選條件使用。
ALTER TABLE sellers
  ADD COLUMN can_provide_proof boolean NOT NULL DEFAULT false;
