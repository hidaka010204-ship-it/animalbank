import pg from 'pg';
const { Client } = pg;
const c = new Client({ connectionString: process.argv[2], ssl: { rejectUnauthorized: false } });
await c.connect();

// profiles / users テーブルの存在確認
const { rows: tables } = await c.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`);
console.log('=== public テーブル一覧 ===');
console.log(tables.map(r => r.table_name).join(', '));

// profiles テーブルがあれば is_admin 系カラム確認
for (const t of ['profiles', 'users', 'user_profiles']) {
  if (tables.some(r => r.table_name === t)) {
    const { rows } = await c.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
    `, [t]);
    console.log(`\n=== ${t} カラム ===`);
    console.table(rows);
  }
}

await c.end();
