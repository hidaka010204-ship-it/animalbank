-- ID: 7ea3897d-9329-497c-9079-365be3a5ae2c の投稿を削除
-- Supabase SQL Editor で実行してください

-- 削除前に対象を確認
SELECT id, type, content, created_at
FROM posts
WHERE id = '7ea3897d-9329-497c-9079-365be3a5ae2c';

-- 削除実行
DELETE FROM posts
WHERE id = '7ea3897d-9329-497c-9079-365be3a5ae2c';
