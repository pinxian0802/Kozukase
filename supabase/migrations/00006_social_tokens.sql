-- 新增 social_tokens 表（儲存加密的 OAuth access token）
CREATE TABLE social_tokens (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id      uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  platform       text NOT NULL CHECK (platform IN ('instagram', 'threads')),
  access_token   text NOT NULL,  -- AES-256-GCM 加密後的 token（格式：iv:authTag:ciphertext，base64）
  expires_at     timestamptz NOT NULL,
  last_refreshed timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seller_id, platform)
);

-- RLS：僅 service_role 可存取，前端完全無法讀寫
ALTER TABLE social_tokens ENABLE ROW LEVEL SECURITY;
-- 不建立任何允許 anon / authenticated 的 policy，確保前端完全無法存取

-- 新增賣家表的連結時間欄位（各平台獨立）
ALTER TABLE sellers
  ADD COLUMN IF NOT EXISTS ig_connected_at      timestamptz,
  ADD COLUMN IF NOT EXISTS threads_connected_at timestamptz;
