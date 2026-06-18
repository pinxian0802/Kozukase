-- 修正：賣家按「我已傳送」後，驗證碼轉入待審（pending）時會清空 expires_at（不再過期）。
-- 但 expires_at 原為 NOT NULL，導致該更新一律失敗（500），狀態永遠卡在 created。
-- 過期檢查只對 created 狀態有意義，故 expires_at 改為可為 null。
ALTER TABLE ig_verification_codes ALTER COLUMN expires_at DROP NOT NULL;
