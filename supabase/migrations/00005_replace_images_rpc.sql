-- Atomic image replacement for listing_images and connection_images.
-- These functions guarantee that DELETE + INSERT happen in a single PostgreSQL
-- transaction, so a partial failure can never leave a record with zero images
-- after the delete step succeeds but before the insert step completes.
--
-- HOW TO APPLY:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste and run this entire file
--   OR run via CLI:
--      npx supabase db push   (if project is linked)

-- ─── replace_listing_images ──────────────────────────────────────────────────
-- p_listing_id : uuid  – the listing to update
-- p_images     : jsonb – array of {r2_key, url, sort_order}
-- Returns void. Rolls back entirely if any insert fails.
CREATE OR REPLACE FUNCTION replace_listing_images(
  p_listing_id uuid,
  p_images     jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Remove all existing images for this listing
  DELETE FROM listing_images WHERE listing_id = p_listing_id;

  -- Insert the new set (no-op if empty array passed)
  IF jsonb_array_length(p_images) > 0 THEN
    INSERT INTO listing_images (listing_id, r2_key, url, sort_order)
    SELECT
      p_listing_id,
      (elem->>'r2_key')::text,
      (elem->>'url')::text,
      (elem->>'sort_order')::smallint
    FROM jsonb_array_elements(p_images) AS elem;
  END IF;
END;
$$;

-- ─── replace_connection_images ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION replace_connection_images(
  p_connection_id uuid,
  p_images        jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM connection_images WHERE connection_id = p_connection_id;

  IF jsonb_array_length(p_images) > 0 THEN
    INSERT INTO connection_images (connection_id, r2_key, url, sort_order)
    SELECT
      p_connection_id,
      (elem->>'r2_key')::text,
      (elem->>'url')::text,
      (elem->>'sort_order')::smallint
    FROM jsonb_array_elements(p_images) AS elem;
  END IF;
END;
$$;
