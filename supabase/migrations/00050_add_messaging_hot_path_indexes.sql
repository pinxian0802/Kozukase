-- 上線前效能:訊息功能熱路徑索引。
-- messages 原本只有主鍵索引,依 conversation_id 載入對話訊息會 seq scan 全表,
-- 訊息量成長後每次開啟對話都線性變慢。加上 (conversation_id, created_at) 覆蓋
-- 「載入某對話的訊息並依時間排序」這個最高頻查詢。
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages (conversation_id, created_at);

-- conversations 既有 unique(buyer_id, seller_id) 只能服務 buyer_id 前綴查詢;
-- 賣家收件匣依 seller_id 篩選需要獨立索引。
CREATE INDEX IF NOT EXISTS idx_conversations_seller
  ON public.conversations (seller_id);
