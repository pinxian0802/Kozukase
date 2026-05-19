-- listing_views: 記錄刊登頁瀏覽
CREATE TABLE listing_views (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  viewer_id   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  viewed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_listing_views_listing_id ON listing_views(listing_id);
CREATE INDEX idx_listing_views_viewed_at  ON listing_views(viewed_at);

ALTER TABLE listing_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listing_views_insert"
  ON listing_views FOR INSERT
  WITH CHECK (viewer_id IS NULL OR viewer_id = auth.uid());

CREATE POLICY "listing_views_select_seller"
  ON listing_views FOR SELECT
  TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE seller_id = auth.uid()
    )
  );

-- profile_views: 記錄賣家主頁瀏覽
CREATE TABLE profile_views (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id  uuid        NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  viewer_id  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  viewed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profile_views_seller_id ON profile_views(seller_id);
CREATE INDEX idx_profile_views_viewed_at ON profile_views(viewed_at);

ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_views_insert"
  ON profile_views FOR INSERT
  WITH CHECK (viewer_id IS NULL OR viewer_id = auth.uid());

CREATE POLICY "profile_views_select_seller"
  ON profile_views FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

-- social_link_clicks: 記錄 IG / Threads 連結點擊
CREATE TABLE social_link_clicks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   uuid        NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  platform    text        NOT NULL CHECK (platform IN ('ig', 'threads')),
  clicker_id  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  clicked_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_social_link_clicks_seller_id ON social_link_clicks(seller_id);
CREATE INDEX idx_social_link_clicks_clicked_at ON social_link_clicks(clicked_at);

ALTER TABLE social_link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_link_clicks_insert"
  ON social_link_clicks FOR INSERT
  WITH CHECK (clicker_id IS NULL OR clicker_id = auth.uid());

CREATE POLICY "social_link_clicks_select_seller"
  ON social_link_clicks FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());
