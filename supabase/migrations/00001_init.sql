-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE product_category AS ENUM (
  'fashion', 'beauty', 'health', 'food', 'electronics',
  'lifestyle', 'sports', 'toys', 'books', 'pets',
  'culture', 'automotive', 'baby', 'jewelry', 'other'
);

CREATE TYPE listing_status AS ENUM (
  'draft', 'active', 'inactive', 'pending_approval'
);

CREATE TYPE inactive_reason AS ENUM (
  'self', 'expired', 'admin', 'product_removed'
);

CREATE TYPE review_status AS ENUM (
  'visible', 'hidden'
);

CREATE TYPE report_status AS ENUM (
  'pending', 'resolved', 'dismissed'
);

CREATE TYPE notification_type AS ENUM (
  'review_received',
  'review_liked',
  'listing_removed_by_admin',
  'listing_republish_approved',
  'connection_removed_by_admin',
  'connection_republish_approved',
  'product_removed',
  'product_removed_creator',
  'account_action_taken',
  'new_listing_for_wish',
  'followed_seller_new_listing',
  'wish_product_removed',
  'bookmarked_product_removed'
);

CREATE TYPE connection_status AS ENUM (
  'active', 'ended', 'pending_approval'
);

CREATE TYPE ended_reason AS ENUM (
  'self', 'expired', 'admin'
);

-- profiles
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- sellers
CREATE TABLE sellers (
  id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone_number text NOT NULL,
  phone_verified boolean NOT NULL DEFAULT false,
  ig_handle text,
  threads_handle text,
  ig_follower_count integer,
  threads_follower_count integer,
  social_connected_at timestamptz,
  is_social_verified boolean NOT NULL DEFAULT false,
  is_suspended boolean NOT NULL DEFAULT false,
  suspended_at timestamptz,
  avg_rating numeric(3,2),
  review_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- regions
CREATE TABLE regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL
);

-- Seed default regions
INSERT INTO regions (name) VALUES
  ('日本'), ('韓國'), ('美國'), ('英國'), ('法國'), ('德國'), ('義大利'), ('澳洲'), ('泰國'), ('其他');

-- seller_regions
CREATE TABLE seller_regions (
  seller_id uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  region_id uuid NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  PRIMARY KEY (seller_id, region_id)
);

-- products (catalog_image_id added later via ALTER)
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text,
  category product_category NOT NULL DEFAULT 'other',
  catalog_image_id uuid, -- FK added after product_images exists
  is_removed boolean NOT NULL DEFAULT false,
  removed_at timestamptz,
  removed_by uuid REFERENCES profiles(id),
  search_text text GENERATED ALWAYS AS (lower(name) || ' ' || lower(coalesce(brand, ''))) STORED,
  wish_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- product_images
CREATE TABLE product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  r2_key text NOT NULL,
  url text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Now add FK for catalog_image_id
ALTER TABLE products
  ADD CONSTRAINT fk_catalog_image
  FOREIGN KEY (catalog_image_id) REFERENCES product_images(id) ON DELETE SET NULL;

-- listings
CREATE TABLE listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  seller_id uuid NOT NULL REFERENCES sellers(id),
  status listing_status NOT NULL DEFAULT 'draft',
  inactive_reason inactive_reason,
  admin_note text,
  price numeric(10,2),
  is_price_on_request boolean NOT NULL DEFAULT false,
  specs jsonb,
  note text,
  post_url text NOT NULL,
  shipping_days integer NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- listing_images
CREATE TABLE listing_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  r2_key text NOT NULL,
  url text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- reviews
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES sellers(id),
  reviewer_id uuid NOT NULL REFERENCES profiles(id),
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  seller_reply text,
  seller_replied_at timestamptz,
  status review_status NOT NULL DEFAULT 'visible',
  like_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seller_id, reviewer_id)
);

-- review_likes
CREATE TABLE review_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, user_id)
);

-- reports
CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES profiles(id),
  listing_id uuid REFERENCES listings(id),
  review_id uuid REFERENCES reviews(id),
  connection_id uuid, -- FK added after connections table
  seller_id uuid REFERENCES sellers(id),
  reason text NOT NULL,
  status report_status NOT NULL DEFAULT 'pending',
  admin_note text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (listing_id IS NOT NULL)::int +
    (review_id IS NOT NULL)::int +
    (connection_id IS NOT NULL)::int +
    (seller_id IS NOT NULL)::int = 1
  )
);

-- notifications
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES profiles(id),
  type notification_type NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- product_bookmarks
CREATE TABLE product_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  product_id uuid NOT NULL REFERENCES products(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

-- listing_bookmarks
CREATE TABLE listing_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  listing_id uuid NOT NULL REFERENCES listings(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id)
);

-- follows
CREATE TABLE follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES profiles(id),
  seller_id uuid NOT NULL REFERENCES sellers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, seller_id)
);

-- connections
CREATE TABLE connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES sellers(id),
  region_id uuid NOT NULL REFERENCES regions(id),
  sub_region text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  description text,
  status connection_status NOT NULL DEFAULT 'active',
  ended_reason ended_reason,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Now add FK for reports.connection_id
ALTER TABLE reports
  ADD CONSTRAINT fk_reports_connection
  FOREIGN KEY (connection_id) REFERENCES connections(id);

-- connection_images
CREATE TABLE connection_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  r2_key text NOT NULL,
  url text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- wishes
CREATE TABLE wishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  product_id uuid NOT NULL REFERENCES products(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

-- INDEXES
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_product_id ON listings(product_id);
CREATE INDEX idx_listings_seller_id ON listings(seller_id);
CREATE INDEX idx_listings_price ON listings(price);
CREATE INDEX idx_listings_shipping_days ON listings(shipping_days);
CREATE INDEX idx_listings_created_at ON listings(created_at);
CREATE INDEX idx_products_search_text ON products USING gin(search_text gin_trgm_ops);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_wishes_product_id ON wishes(product_id);
CREATE INDEX idx_follows_seller_id ON follows(seller_id);
CREATE INDEX idx_notifications_recipient_read ON notifications(recipient_id, is_read);
CREATE INDEX idx_review_likes_review_id ON review_likes(review_id);
CREATE INDEX idx_listing_images_listing_id ON listing_images(listing_id);
CREATE INDEX idx_connection_images_connection_id ON connection_images(connection_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_product_bookmarks_user ON product_bookmarks(user_id);
CREATE INDEX idx_listing_bookmarks_user ON listing_bookmarks(user_id);

-- TRIGGERS

-- 1. Update wish_count on wishes insert/delete
CREATE OR REPLACE FUNCTION update_wish_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE products SET wish_count = wish_count + 1 WHERE id = NEW.product_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE products SET wish_count = wish_count - 1 WHERE id = OLD.product_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wish_count
  AFTER INSERT OR DELETE ON wishes
  FOR EACH ROW EXECUTE FUNCTION update_wish_count();

-- 2. Update review_count and avg_rating on reviews insert/delete/update
CREATE OR REPLACE FUNCTION update_seller_review_stats() RETURNS trigger AS $$
DECLARE
  target_seller_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_seller_id := OLD.seller_id;
  ELSE
    target_seller_id := NEW.seller_id;
  END IF;
  
  UPDATE sellers SET
    review_count = (SELECT count(*) FROM reviews WHERE seller_id = target_seller_id AND status = 'visible'),
    avg_rating = (SELECT avg(rating)::numeric(3,2) FROM reviews WHERE seller_id = target_seller_id AND status = 'visible')
  WHERE id = target_seller_id;
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_seller_review_stats
  AFTER INSERT OR DELETE OR UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_seller_review_stats();

-- 3. Update like_count on review_likes insert/delete
CREATE OR REPLACE FUNCTION update_review_like_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE reviews SET like_count = like_count + 1 WHERE id = NEW.review_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE reviews SET like_count = like_count - 1 WHERE id = OLD.review_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_review_like_count
  AFTER INSERT OR DELETE ON review_likes
  FOR EACH ROW EXECUTE FUNCTION update_review_like_count();

-- 4. Enforce listing limit (25 per seller)
CREATE OR REPLACE FUNCTION check_listing_limit() RETURNS trigger AS $$
DECLARE
  cnt integer;
BEGIN
  SELECT count(*) INTO cnt FROM listings WHERE seller_id = NEW.seller_id;
  IF cnt >= 25 THEN
    RAISE EXCEPTION 'Listing limit exceeded (max 25 per seller)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_listing_limit
  BEFORE INSERT ON listings
  FOR EACH ROW EXECUTE FUNCTION check_listing_limit();

-- 5. Enforce connection limit (5 per seller)
CREATE OR REPLACE FUNCTION check_connection_limit() RETURNS trigger AS $$
DECLARE
  cnt integer;
BEGIN
  SELECT count(*) INTO cnt FROM connections WHERE seller_id = NEW.seller_id;
  IF cnt >= 5 THEN
    RAISE EXCEPTION 'Connection limit exceeded (max 5 per seller)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_connection_limit
  BEFORE INSERT ON connections
  FOR EACH ROW EXECUTE FUNCTION check_connection_limit();

-- 6. Enforce wish limit (20 per user)
CREATE OR REPLACE FUNCTION check_wish_limit() RETURNS trigger AS $$
DECLARE
  cnt integer;
BEGIN
  SELECT count(*) INTO cnt FROM wishes WHERE user_id = NEW.user_id;
  IF cnt >= 20 THEN
    RAISE EXCEPTION 'Wish limit exceeded (max 20 per user)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wish_limit
  BEFORE INSERT ON wishes
  FOR EACH ROW EXECUTE FUNCTION check_wish_limit();

-- 7. Enforce listing image limit (5 per listing)
CREATE OR REPLACE FUNCTION check_listing_image_limit() RETURNS trigger AS $$
DECLARE
  cnt integer;
BEGIN
  SELECT count(*) INTO cnt FROM listing_images WHERE listing_id = NEW.listing_id;
  IF cnt >= 5 THEN
    RAISE EXCEPTION 'Listing image limit exceeded (max 5 per listing)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_listing_image_limit
  BEFORE INSERT ON listing_images
  FOR EACH ROW EXECUTE FUNCTION check_listing_image_limit();

-- 8. Enforce connection image limit (5 per connection)
CREATE OR REPLACE FUNCTION check_connection_image_limit() RETURNS trigger AS $$
DECLARE
  cnt integer;
BEGIN
  SELECT count(*) INTO cnt FROM connection_images WHERE connection_id = NEW.connection_id;
  IF cnt >= 5 THEN
    RAISE EXCEPTION 'Connection image limit exceeded (max 5 per connection)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_connection_image_limit
  BEFORE INSERT ON connection_images
  FOR EACH ROW EXECUTE FUNCTION check_connection_image_limit();

-- 9. Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sellers_updated_at BEFORE UPDATE ON sellers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_listings_updated_at BEFORE UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_connections_updated_at BEFORE UPDATE ON connections FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RPC: search_products
CREATE OR REPLACE FUNCTION search_products(
  search_query text,
  category_filter product_category DEFAULT NULL,
  result_limit integer DEFAULT 20,
  result_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  brand text,
  category product_category,
  catalog_image_id uuid,
  wish_count integer,
  similarity_score real
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.brand,
    p.category,
    p.catalog_image_id,
    p.wish_count,
    similarity(p.search_text, lower(search_query)) AS similarity_score
  FROM products p
  WHERE p.is_removed = false
    AND (category_filter IS NULL OR p.category = category_filter)
    AND (
      p.search_text % lower(search_query)
      OR p.search_text ILIKE '%' || search_query || '%'
    )
  ORDER BY similarity_score DESC, p.wish_count DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql STABLE;
