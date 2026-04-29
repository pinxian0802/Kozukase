ALTER TABLE connections ADD COLUMN IF NOT EXISTS locations text[] NOT NULL DEFAULT '{}';

UPDATE connections
SET locations = ARRAY[sub_region]
WHERE sub_region IS NOT NULL
  AND (locations IS NULL OR locations = '{}');

ALTER TABLE connections DROP COLUMN IF EXISTS sub_region;