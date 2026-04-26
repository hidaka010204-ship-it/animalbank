-- profilesテーブルにcityカラムを追加
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city text;
