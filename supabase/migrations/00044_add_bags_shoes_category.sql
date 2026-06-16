-- 新增商品分類：bags（包包配件）、shoes（鞋類）
-- 首頁分類列將「包包配件」「鞋類」從「時尚穿搭」獨立出來，後端 product_category enum 需同步新增，
-- 否則搜尋 RPC（category_filter product_category）收到新值會因 enum 不含該值而報錯。
-- 使用 IF NOT EXISTS 確保冪等；僅含 ALTER TYPE，不在同一交易內使用新值。
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'bags' AFTER 'luxury';
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'shoes' AFTER 'bags';
