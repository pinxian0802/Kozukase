-- Threads 人工審核驗證:獨立待審名單(不過期、含審核狀態)
CREATE TABLE threads_verification_requests (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id        uuid        NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  threads_username text        NOT NULL,
  code             text        NOT NULL,
  status           text        NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  reject_reason    text,
  reviewed_at      timestamptz,
  reviewed_by      uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- 加速「列出待審」與「查某賣家未通過申請」
CREATE INDEX idx_threads_verif_status ON threads_verification_requests (status, created_at);
CREATE INDEX idx_threads_verif_seller ON threads_verification_requests (seller_id);

-- 與 ig_verification_codes 一致:不建立任何 anon/authenticated policy,
-- 確保前端完全無法直接存取(只有 service-role 後端能讀寫)。
ALTER TABLE threads_verification_requests ENABLE ROW LEVEL SECURITY;

-- 站內通知類型新增兩個值(Postgres enum)
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'threads_verification_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'threads_verification_rejected';
