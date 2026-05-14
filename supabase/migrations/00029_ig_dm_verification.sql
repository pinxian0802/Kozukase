-- sellers 加上 ig_user_id（Meta 永久識別碼）與 ig_connected_at（若尚未有的話）
ALTER TABLE sellers
  ADD COLUMN IF NOT EXISTS ig_user_id      text,
  ADD COLUMN IF NOT EXISTS ig_connected_at timestamptz;

-- 驗證碼表
CREATE TABLE ig_verification_codes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   uuid        NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  ig_username text        NOT NULL,
  code        text        NOT NULL,
  expires_at  timestamptz NOT NULL,
  verified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 不建立任何 anon/authenticated policy，確保前端完全無法直接存取
ALTER TABLE ig_verification_codes ENABLE ROW LEVEL SECURITY;
