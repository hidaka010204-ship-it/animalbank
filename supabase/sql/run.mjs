// Supabase PostgreSQL に直接接続して post_likes.sql を実行するスクリプト
// 使い方: node supabase/sql/run.mjs <接続文字列>
// 例: node supabase/sql/run.mjs "postgresql://postgres.xxx:password@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const { Client } = pg;

const connStr = process.argv[2];
if (!connStr) {
  console.error('使い方: node supabase/sql/run.mjs "<接続文字列>"');
  process.exit(1);
}

const __dir = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dir, 'post_likes.sql'), 'utf8');

const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log('接続成功');

  const res = await client.query(sql);
  // 最後のクエリ（確認クエリ）の結果を表示
  const rows = Array.isArray(res) ? res[res.length - 1].rows : res.rows;
  console.log('\n=== ポリシー一覧 ===');
  console.table(rows);
  console.log('\n✅ SQL 実行完了');
} catch (e) {
  console.error('❌ エラー:', e.message);
} finally {
  await client.end();
}
