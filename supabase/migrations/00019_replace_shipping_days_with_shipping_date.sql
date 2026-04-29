-- listings: replace shipping_days (integer) with shipping_date (date)
ALTER TABLE listings ADD COLUMN shipping_date date;
ALTER TABLE listings DROP COLUMN shipping_days;

-- connections: add required shipping_date
ALTER TABLE connections ADD COLUMN shipping_date date NOT NULL DEFAULT '2026-01-01';
ALTER TABLE connections ALTER COLUMN shipping_date DROP DEFAULT;