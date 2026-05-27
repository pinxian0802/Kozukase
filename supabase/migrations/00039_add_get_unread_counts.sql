-- get_unread_counts：算出每個對話有幾則「對方傳來、且在我上次已讀之後」的未讀訊息
-- 此函式線上資料庫已存在但先前未進版控；補上以確保重建環境時不會遺失。
CREATE OR REPLACE FUNCTION public.get_unread_counts(
  p_user_id uuid,
  p_conversation_ids uuid[]
)
RETURNS TABLE(conversation_id uuid, unread_count bigint)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    m.conversation_id,
    COUNT(*) AS unread_count
  FROM messages m
  JOIN conversations c ON c.id = m.conversation_id
  WHERE m.conversation_id = ANY(p_conversation_ids)
    AND m.sender_id != p_user_id
    AND m.created_at > COALESCE(
      CASE WHEN c.buyer_id = p_user_id THEN c.buyer_last_read_at
           ELSE c.seller_last_read_at END,
      '-infinity'::timestamptz
    )
  GROUP BY m.conversation_id
$function$;
