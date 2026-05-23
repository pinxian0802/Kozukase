-- Migration 00035: 商品頁 / 連線頁瀏覽記錄(比照 listing_views）

-- product_views：記錄商品頁瀏覽
CREATE TABLE product_views (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  viewer_id   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  viewed_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_views_product_id ON product_views(product_id);
CREATE INDEX idx_product_views_viewed_at  ON product_views(viewed_at);
ALTER TABLE product_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_views_insert"
  ON product_views FOR INSERT
  WITH CHECK (viewer_id IS NULL OR viewer_id = auth.uid());
-- 商品無單一擁有者:在此商品有刊登的賣家可看
CREATE POLICY "product_views_select_seller"
  ON product_views FOR SELECT
  TO authenticated
  USING (
    product_id IN (SELECT product_id FROM listings WHERE seller_id = auth.uid())
  );

-- connection_views：記錄連線頁瀏覽
CREATE TABLE connection_views (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id  uuid        NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  viewer_id      uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  viewed_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_connection_views_connection_id ON connection_views(connection_id);
CREATE INDEX idx_connection_views_viewed_at     ON connection_views(viewed_at);
ALTER TABLE connection_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "connection_views_insert"
  ON connection_views FOR INSERT
  WITH CHECK (viewer_id IS NULL OR viewer_id = auth.uid());
CREATE POLICY "connection_views_select_seller"
  ON connection_views FOR SELECT
  TO authenticated
  USING (
    connection_id IN (SELECT id FROM connections WHERE seller_id = auth.uid())
  );
