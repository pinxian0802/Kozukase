-- 許願表加入 content 欄位（許願內容說明）
ALTER TABLE wishes ADD COLUMN content text NOT NULL DEFAULT '';
ALTER TABLE wishes ALTER COLUMN content DROP DEFAULT;
