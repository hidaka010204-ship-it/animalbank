-- ============================================================
-- 登録フォーム送信エラーの修正
-- Supabase SQL Editor でこのファイルを実行してください
-- ============================================================

-- 1. source カラムを追加（未追加の場合）
ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'shelter';

UPDATE animals SET source = 'shelter' WHERE source IS NULL OR source = '';

-- 2. shelter / prefecture の直接テキストカラムを追加（未追加の場合）
--    ※ shelters テーブル（FK）とは別に、フリーテキスト保存用として使用
ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS shelter TEXT;

ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS prefecture TEXT;

-- 3. RLS ポリシー: anon ユーザーが animals に INSERT できるようにする
--    （保健所登録・一般登録フォームどちらも未認証で使用できるようにする）
ALTER TABLE animals ENABLE ROW LEVEL SECURITY;

-- 既存ポリシーを確認して重複を避けるため IF NOT EXISTS で作成
DO $$
BEGIN
  -- SELECT: 全員が閲覧可
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'animals' AND policyname = 'Allow public select'
  ) THEN
    CREATE POLICY "Allow public select" ON animals
      FOR SELECT USING (true);
  END IF;

  -- INSERT: anon / authenticated どちらも許可
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'animals' AND policyname = 'Allow anon insert'
  ) THEN
    CREATE POLICY "Allow anon insert" ON animals
      FOR INSERT WITH CHECK (true);
  END IF;

  -- UPDATE: anon / authenticated どちらも許可（画像 URL 更新に必要）
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'animals' AND policyname = 'Allow anon update'
  ) THEN
    CREATE POLICY "Allow anon update" ON animals
      FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- 4. animal-images Storage バケットのポリシー
--    Supabase ダッシュボード > Storage > Policies からも設定可能
--    以下は SQL でバケットを public にする方法

-- バケットを public に変更（既に public なら不要）
UPDATE storage.buckets
  SET public = true
  WHERE id = 'animal-images';

-- Storage の INSERT ポリシー（anon がアップロードできるよう）
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES
  ('Allow anon upload', 'animal-images', 'INSERT', 'true'),
  ('Allow anon select', 'animal-images', 'SELECT', 'true'),
  ('Allow anon update', 'animal-images', 'UPDATE', 'true')
ON CONFLICT (name, bucket_id) DO NOTHING;
