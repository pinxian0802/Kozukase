-- Drop existing generated search_text (cannot alter, must drop and re-add)
ALTER TABLE products DROP COLUMN search_text;

-- Add aliases column
ALTER TABLE products ADD COLUMN aliases text[] NOT NULL DEFAULT '{}';

-- Add search_text as a regular (non-generated) column
-- Note: GENERATED ALWAYS AS cannot use array_to_string (STABLE, not IMMUTABLE),
-- so we use a trigger to keep search_text in sync instead.
ALTER TABLE products ADD COLUMN search_text text;

-- Backfill existing rows
UPDATE products SET search_text = lower(name) || ' ' || lower(array_to_string(aliases, ' '));

-- Create trigger function to keep search_text in sync
CREATE OR REPLACE FUNCTION products_search_text_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_text := lower(NEW.name) || ' ' || lower(array_to_string(NEW.aliases, ' '));
  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_products_search_text ON products;
CREATE TRIGGER trg_products_search_text
BEFORE INSERT OR UPDATE OF name, aliases
ON products
FOR EACH ROW
EXECUTE FUNCTION products_search_text_update();

-- Recreate GIN index for trgm
CREATE INDEX idx_products_search_text ON products USING gin(search_text gin_trgm_ops);

-- Add simple RPC: returns product IDs matching a query via trgm (used by buyer browse)
CREATE OR REPLACE FUNCTION search_product_ids(search_query text)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT p.id
  FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
  WHERE p.is_removed = false
    AND (
      p.search_text % lower(search_query)
      OR p.search_text ILIKE '%' || lower(search_query) || '%'
      OR COALESCE(b.name, '') ILIKE '%' || search_query || '%'
    );
$$;
