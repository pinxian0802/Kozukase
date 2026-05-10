-- connection_bookmarks
CREATE TABLE connection_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  connection_id uuid NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connection_id)
);

CREATE INDEX idx_connection_bookmarks_user ON connection_bookmarks(user_id);

ALTER TABLE connection_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "connection_bookmarks_select_own"
  ON connection_bookmarks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "connection_bookmarks_insert_own"
  ON connection_bookmarks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "connection_bookmarks_delete_own"
  ON connection_bookmarks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
