-- 新增通知類型：賣家回覆了你的評價
-- 注意：ALTER TYPE ... ADD VALUE 不能在交易區塊中與其他語句混用，故本檔案僅含此一語句。
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'review_replied';
