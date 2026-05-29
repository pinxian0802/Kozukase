-- 新增商品分類
-- 1. luxury（精品/名牌）：本次新增。
-- 2. idol（明星偶像）：應用層已使用，但先前未隨任何 migration 建立，於此一併補上。
--    使用 IF NOT EXISTS 確保冪等——若正式環境已手動加過此值，重複執行也不會出錯。
-- 注意：ALTER TYPE ... ADD VALUE 不能在交易區塊中與其他語句混用，亦不能在同一交易內使用新值，
--       故本檔案僅含 ALTER TYPE 語句。
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'idol' AFTER 'jewelry';
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'luxury' AFTER 'fashion';
