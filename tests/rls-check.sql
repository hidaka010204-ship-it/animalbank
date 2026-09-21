-- ① RLS ポリシー一覧（主要テーブル）
SELECT tablename, policyname, permissive, cmd, qual
FROM pg_policies
WHERE tablename IN ('posts', 'animals', 'contacts', 'notifications', 'adoptions', 'reports')
ORDER BY tablename, cmd;

-- ② Storage バケット一覧とポリシー
SELECT id, name, public FROM storage.buckets;
SELECT bucket_id, name, definition FROM storage.policies;

-- ③ anon ロールで posts INSERT できるか（テスト）
-- このクエリを SQL Editor で anon ロールとして実行:
-- SET ROLE anon;
-- INSERT INTO posts (type, content, user_id) VALUES ('other', 'RLS_TEST', null) RETURNING id;

-- ④ 必要な最小 RLS ポリシー
-- posts: 未ログインでもINSERT可能にする（匿名投稿を許可する場合）
-- CREATE POLICY "allow anon insert posts" ON posts FOR INSERT TO anon WITH CHECK (true);

-- posts: 未ログインでもUPDATE可能にする（images更新のため）
-- CREATE POLICY "allow anon update own posts" ON posts FOR UPDATE TO anon
--   USING (user_id IS NULL) WITH CHECK (user_id IS NULL);

-- animals: 未ログインでもINSERT可能にする
-- CREATE POLICY "allow anon insert animals" ON animals FOR INSERT TO anon WITH CHECK (true);

-- contacts: 未ログインでもINSERT可能にする
-- CREATE POLICY "allow anon insert contacts" ON contacts FOR INSERT TO anon WITH CHECK (true);

-- Storage post-images: 未ログインでもアップロード可能にする
-- Storage ダッシュボード > post-images > Policies > New policy:
--   Operation: INSERT, Role: anon, Policy: true

-- Storage animal-images: 同様
--   Operation: INSERT, Role: anon, Policy: true
