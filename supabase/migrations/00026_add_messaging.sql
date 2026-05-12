-- conversations：每對 buyer/seller 唯一一筆
CREATE TABLE conversations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id            uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  buyer_last_read_at   timestamptz,
  seller_last_read_at  timestamptz,
  last_message_at      timestamptz,
  last_message_preview text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (buyer_id, seller_id),
  CHECK (buyer_id <> seller_id)
);

-- messages：對話裡的每一則訊息
CREATE TABLE messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES profiles(id),
  body            text,
  image_url       text,
  context_type    text CHECK (context_type IN ('listing', 'connection')),
  context_id      uuid,
  context_label   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT body_or_image CHECK (body IS NOT NULL OR image_url IS NOT NULL)
);

-- RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants_select_conversations"
  ON conversations FOR SELECT
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "buyer_insert_conversation"
  ON conversations FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "participants_update_conversation"
  ON conversations FOR UPDATE
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "participants_select_messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_id
        AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
  );

CREATE POLICY "participants_insert_messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_id
        AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
  );

-- 開啟 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
