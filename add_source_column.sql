-- animalsテーブルに登録者タイプを区別するカラムを追加
-- source: 'shelter' = 保健所登録, 'public' = 一般ユーザー登録
-- 既存データは保健所データとして扱うため DEFAULT 'shelter'

ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'shelter';

-- 既存レコードを明示的に 'shelter' に設定
UPDATE animals SET source = 'shelter' WHERE source IS NULL OR source = '';
