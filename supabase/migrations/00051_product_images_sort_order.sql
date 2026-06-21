-- 商品圖片支援多張並可排序:product_images 原無 sort_order(listing_images /
-- connection_images 有),多張時順序不穩定。新增 sort_order,並回填現有資料——
-- 每個商品內,封面(catalog_image_id)排 0,其餘依 created_at 接續。
ALTER TABLE product_images
  ADD COLUMN sort_order smallint NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT pi.id,
         ROW_NUMBER() OVER (
           PARTITION BY pi.product_id
           ORDER BY (p.catalog_image_id = pi.id) DESC, pi.created_at
         ) - 1 AS rn
  FROM product_images pi
  JOIN products p ON p.id = pi.product_id
)
UPDATE product_images pi
SET sort_order = ordered.rn
FROM ordered
WHERE ordered.id = pi.id;
