-- ============================================================
-- RLS policies for all public tables.
-- social_tokens is intentionally excluded — service_role only.
-- All writes by service_role (tRPC) already bypass RLS.
-- These policies govern authenticated-user direct access and
-- Supabase Realtime postgres_changes subscriptions.
-- ============================================================

-- ----------------------
-- regions (lookup table)
-- ----------------------
CREATE POLICY "regions_select_all"
  ON regions FOR SELECT
  USING (true);

-- ----------------------
-- sellers
-- ----------------------
CREATE POLICY "sellers_select_authenticated"
  ON sellers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "sellers_insert_own"
  ON sellers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "sellers_update_own"
  ON sellers FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ----------------------
-- seller_regions
-- ----------------------
CREATE POLICY "seller_regions_select_authenticated"
  ON seller_regions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "seller_regions_insert_own"
  ON seller_regions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "seller_regions_delete_own"
  ON seller_regions FOR DELETE
  TO authenticated
  USING (auth.uid() = seller_id);

-- ----------------------
-- products
-- ----------------------
CREATE POLICY "products_select_authenticated"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "products_insert_own"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- ----------------------
-- product_images
-- ----------------------
CREATE POLICY "product_images_select_authenticated"
  ON product_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "product_images_insert_own"
  ON product_images FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "product_images_delete_own"
  ON product_images FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);

-- ----------------------
-- listings
-- ----------------------
CREATE POLICY "listings_select_authenticated"
  ON listings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "listings_insert_own_seller"
  ON listings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "listings_update_own_seller"
  ON listings FOR UPDATE
  TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- ----------------------
-- listing_images
-- ----------------------
CREATE POLICY "listing_images_select_authenticated"
  ON listing_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "listing_images_insert_own"
  ON listing_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings WHERE id = listing_id AND seller_id = auth.uid()
    )
  );

CREATE POLICY "listing_images_delete_own"
  ON listing_images FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings WHERE id = listing_id AND seller_id = auth.uid()
    )
  );

-- ----------------------
-- reviews
-- ----------------------
CREATE POLICY "reviews_select_authenticated"
  ON reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "reviews_insert_own"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reviewer_id);

-- Reviewer can edit their comment; seller can add/edit their reply
CREATE POLICY "reviews_update_reviewer_or_seller"
  ON reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = reviewer_id OR auth.uid() = seller_id);

-- ----------------------
-- review_likes
-- ----------------------
CREATE POLICY "review_likes_select_authenticated"
  ON review_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "review_likes_insert_own"
  ON review_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "review_likes_delete_own"
  ON review_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ----------------------
-- reports (reporter sees own; admin via service_role)
-- ----------------------
CREATE POLICY "reports_select_own"
  ON reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "reports_insert_own"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- ----------------------
-- notifications (own only — also enables Realtime postgres_changes)
-- ----------------------
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = recipient_id);

CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- ----------------------
-- product_bookmarks
-- ----------------------
CREATE POLICY "product_bookmarks_select_own"
  ON product_bookmarks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "product_bookmarks_insert_own"
  ON product_bookmarks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "product_bookmarks_delete_own"
  ON product_bookmarks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ----------------------
-- listing_bookmarks
-- ----------------------
CREATE POLICY "listing_bookmarks_select_own"
  ON listing_bookmarks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "listing_bookmarks_insert_own"
  ON listing_bookmarks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "listing_bookmarks_delete_own"
  ON listing_bookmarks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ----------------------
-- follows
-- ----------------------
CREATE POLICY "follows_select_authenticated"
  ON follows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "follows_insert_own"
  ON follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows_delete_own"
  ON follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

-- ----------------------
-- wishes
-- ----------------------
CREATE POLICY "wishes_select_own"
  ON wishes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "wishes_insert_own"
  ON wishes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "wishes_delete_own"
  ON wishes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ----------------------
-- connections
-- ----------------------
CREATE POLICY "connections_select_authenticated"
  ON connections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "connections_insert_own_seller"
  ON connections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "connections_update_own_seller"
  ON connections FOR UPDATE
  TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- ----------------------
-- connection_images
-- ----------------------
CREATE POLICY "connection_images_select_authenticated"
  ON connection_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "connection_images_insert_own"
  ON connection_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM connections WHERE id = connection_id AND seller_id = auth.uid()
    )
  );

CREATE POLICY "connection_images_delete_own"
  ON connection_images FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM connections WHERE id = connection_id AND seller_id = auth.uid()
    )
  );
