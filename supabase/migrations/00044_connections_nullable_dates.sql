-- When a seller ends a connection, we clear its start/end dates (the dates only
-- describe an active buying window and become meaningless once ended). That
-- requires the columns to accept NULL.
ALTER TABLE public.connections
  ALTER COLUMN start_date DROP NOT NULL,
  ALTER COLUMN end_date DROP NOT NULL;
