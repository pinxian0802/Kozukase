-- IG 驗證改混合模式：自動為主、人工為輔。擴充既有 ig_verification_codes 承載審核狀態。
ALTER TABLE ig_verification_codes
  ADD COLUMN IF NOT EXISTS status        text NOT NULL DEFAULT 'created', -- created|sent|pending|approved|rejected
  ADD COLUMN IF NOT EXISTS source        text,                            -- auto|manual（離開 sent 時填）
  ADD COLUMN IF NOT EXISTS reject_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by   uuid;

-- 既有資料（若有）：已驗證的補成 approved/auto
UPDATE ig_verification_codes
  SET status = 'approved', source = 'auto'
  WHERE verified_at IS NOT NULL AND status = 'created';

CREATE INDEX IF NOT EXISTS idx_ig_verif_status ON ig_verification_codes (status, created_at);
CREATE INDEX IF NOT EXISTS idx_ig_verif_seller ON ig_verification_codes (seller_id);

-- 站內通知類型
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ig_verification_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ig_verification_rejected';
