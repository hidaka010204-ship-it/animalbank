-- 「むーちゃん」の投稿を posts テーブルから削除する
-- ※ 実行前に SELECT で対象を確認することを推奨

-- 確認用（削除前に対象行を表示）
SELECT id, type, content, user_nickname, created_at
FROM posts
WHERE user_nickname = 'むーちゃん';

-- 削除
DELETE FROM posts
WHERE user_nickname = 'むーちゃん';
