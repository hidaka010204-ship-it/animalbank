-- post_likes テーブル
CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- RLS 有効化
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- 誰でも読める
CREATE POLICY "post_likes_select_all" ON public.post_likes
  FOR SELECT USING (true);

-- ログインユーザーは自分のいいねだけ追加できる
CREATE POLICY "post_likes_insert_own" ON public.post_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ログインユーザーは自分のいいねだけ削除できる
CREATE POLICY "post_likes_delete_own" ON public.post_likes
  FOR DELETE USING (auth.uid() = user_id);

-- posts: 自分の投稿だけ UPDATE できる
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'posts_update_own'
  ) THEN
    CREATE POLICY "posts_update_own" ON public.posts
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- posts: 自分の投稿だけ DELETE できる
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'posts_delete_own'
  ) THEN
    CREATE POLICY "posts_delete_own" ON public.posts
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 確認クエリ
SELECT
  schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('post_likes', 'posts')
ORDER BY tablename, policyname;
