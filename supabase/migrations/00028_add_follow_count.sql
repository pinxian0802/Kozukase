-- 1. Add follow_count column
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS follow_count integer NOT NULL DEFAULT 0;

-- 2. Backfill existing counts
UPDATE sellers s
SET follow_count = (
  SELECT COUNT(*) FROM follows f WHERE f.seller_id = s.id
);

-- 3. Trigger function
CREATE OR REPLACE FUNCTION update_seller_follow_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE sellers SET follow_count = follow_count + 1 WHERE id = NEW.seller_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE sellers SET follow_count = GREATEST(follow_count - 1, 0) WHERE id = OLD.seller_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Attach trigger
DROP TRIGGER IF EXISTS follows_update_follow_count ON follows;
CREATE TRIGGER follows_update_follow_count
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_seller_follow_count();
