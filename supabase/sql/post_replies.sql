-- post_replies テーブル（タイムライン返信の永続化）
CREATE TABLE IF NOT EXISTS public.post_replies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_nickname text,
  user_avatar text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.post_replies ENABLE ROW LEVEL SECURITY;

-- 誰でも読める
CREATE POLICY "post_replies_select_all" ON public.post_replies
  FOR SELECT USING (true);

-- ログインユーザーは自分の返信のみ追加できる
CREATE POLICY "post_replies_insert_own" ON public.post_replies
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ログインユーザーは自分の返信のみ削除できる
CREATE POLICY "post_replies_delete_own" ON public.post_replies
  FOR DELETE USING (auth.uid() = user_id);
