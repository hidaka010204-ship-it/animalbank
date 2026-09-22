import pg from 'pg';
const { Client } = pg;
const c = new Client({ connectionString: process.argv[2], ssl: { rejectUnauthorized: false } });
await c.connect();

const email = 'hidaka010204@gmail.com';

// auth.users からUUID取得
const { rows: users } = await c.query(
  `SELECT id, email FROM auth.users WHERE email = $1`,
  [email]
);

if (users.length === 0) {
  console.error(`❌ ${email} が auth.users に見つかりません`);
  await c.end(); process.exit(1);
}

const userId = users[0].id;
console.log(`✅ ユーザー発見: ${email} → UUID = ${userId}`);

// profiles に行があればUPDATE、なければINSERT（UPSERT）
await c.query(
  `INSERT INTO public.profiles (id, is_admin)
   VALUES ($1, TRUE)
   ON CONFLICT (id) DO UPDATE SET is_admin = TRUE`,
  [userId]
);

// 確認
const { rows: result } = await c.query(
  `SELECT id, is_admin FROM public.profiles WHERE id = $1`,
  [userId]
);
console.log('\n=== profiles 確認 ===');
console.table(result);
console.log('✅ is_admin = true に設定完了');

await c.end();
