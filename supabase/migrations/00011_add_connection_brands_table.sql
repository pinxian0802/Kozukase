CREATE TABLE connection_brands (
  connection_id uuid NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  PRIMARY KEY (connection_id, brand_id)
);
