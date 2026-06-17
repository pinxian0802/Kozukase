-- 新增商品分類：home（家居家飾）
-- 家具、家飾、寢具、廚房收納等，先前多被歸到「生活雜貨（lifestyle）」，於此獨立成一類。
-- 後端 product_category enum 需同步新增，否則搜尋 RPC（category_filter product_category）
-- 收到新值會因 enum 不含該值而報錯。
-- 使用 IF NOT EXISTS 確保冪等；ALTER TYPE ... ADD VALUE 不能在交易內與其他語句混用，故本檔僅含此語句。
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'home' AFTER 'lifestyle';
