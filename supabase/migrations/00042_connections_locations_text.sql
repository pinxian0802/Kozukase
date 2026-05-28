-- Add a flat text mirror of `connections.locations` (text[]) so PostgREST can
-- run reliable ILIKE substring searches. Casting text[] to text on-the-fly via
-- `.filter('locations::text', 'ilike', ...)` gets URL-encoded by supabase-js
-- in a way that PostgREST silently drops the predicate.
--
-- Generated columns reject array_to_string(...) for not being IMMUTABLE per
-- the planner, so we keep a trigger-maintained mirror instead.
ALTER TABLE public.connections
  ADD COLUMN IF NOT EXISTS locations_text text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.sync_connections_locations_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.locations_text := COALESCE(array_to_string(NEW.locations, ' '), '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS connections_sync_locations_text ON public.connections;
CREATE TRIGGER connections_sync_locations_text
  BEFORE INSERT OR UPDATE OF locations ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.sync_connections_locations_text();

-- Backfill existing rows
UPDATE public.connections
SET locations_text = COALESCE(array_to_string(locations, ' '), '')
WHERE locations_text IS DISTINCT FROM COALESCE(array_to_string(locations, ' '), '');
