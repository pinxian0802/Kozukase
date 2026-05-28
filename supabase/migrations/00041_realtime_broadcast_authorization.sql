-- ============================================================
-- Realtime Broadcast Authorization
-- ============================================================
-- 訊息系統從 postgres_changes 改為 Broadcast 後,
-- 需要對 broadcast 頻道的「訂閱」加上權限,
-- 確保使用者只能訂閱自己有權看到的頻道。
--
-- 兩種頻道:
--   1. user:<userId>          → 只有本人能訂(收到「你有新訊息」的輕量通知)
--   2. conversation:<convId>  → 只有對話的買家/賣家能訂(收到完整訊息內容)
--
-- 注意:
-- - Broadcast 寫入由後端用 service_role 進行,service_role 繞過 RLS,
--   因此本次只對「訂閱(SELECT)」方向加 policy,不需要 INSERT policy。
-- - 客戶端訂閱頻道時必須加上 { config: { private: true } },
--   否則 Realtime 不會走 Authorization 流程,policy 形同虛設。
--   公開頻道(預設)不走 RLS,任何人都能訂,絕對不能用在這。
-- - 多條 SELECT policy 用 OR 結合;一條符合即放行。
-- ============================================================

-- 確保 realtime.messages 的 RLS 已啟用(Supabase 預設應已開啟,顯式為求明確)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- Policy 1:個人信箱 user:<auth.uid()>
--   只有本人能訂自己的 user 頻道。
--   頻道名格式必須完全等於 'user:' + 自己的 uuid。
-- ------------------------------------------------------------
CREATE POLICY "broadcast_subscribe_own_user_channel"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    extension = 'broadcast'
    AND realtime.topic() = 'user:' || (SELECT auth.uid())::text
  );


-- ------------------------------------------------------------
-- Policy 2:對話信箱 conversation:<convId>
--   只有該對話的 buyer_id 或 seller_id 能訂。
--   頻道名格式必須是 'conversation:<uuid>'。
--   用 c.id::text = split_part(...) 避免 uuid cast 在格式不對時拋錯。
-- ------------------------------------------------------------
CREATE POLICY "broadcast_subscribe_conversation_participant"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    extension = 'broadcast'
    AND realtime.topic() LIKE 'conversation:%'
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id::text = split_part(realtime.topic(), ':', 2)
        AND (
          c.buyer_id = (SELECT auth.uid())
          OR c.seller_id = (SELECT auth.uid())
        )
    )
  );


-- ============================================================
-- 備註:postgres_changes 維持不動
-- ============================================================
-- notifications 表仍會用 postgres_changes 訂閱(只是會加上 recipient_id filter),
-- 因此「notifications」保留在 supabase_realtime publication 中。
--
-- messages 表的 postgres_changes 在前端全面切換到 broadcast 後,
-- 才會在後續遷移中從 publication 移除(避免來回切換的風險)。
-- ============================================================
