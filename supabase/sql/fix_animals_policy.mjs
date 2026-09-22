import pg from 'pg';
const { Client } = pg;
const c = new Client({ connectionString: process.argv[2], ssl: { rejectUnauthorized: false } });
await c.connect();

const steps = [
  // 1. posts: 匿名 INSERT ポリシーを削除
  {
    label: 'DROP: anon can insert posts',
    sql: `DROP POLICY IF EXISTS "anon can insert posts" ON public.posts`,
  },
  // 2. animals: 過剰なUPDATEポリシーを削除
  {
    label: 'DROP: Allow anon update (animals)',
    sql: `DROP POLICY IF EXISTS "Allow anon update" ON public.animals`,
  },
  {
    label: 'DROP: animals_update_authenticated (qual=true, 全ユーザーが全動物を更新できていた)',
    sql: `DROP POLICY IF EXISTS "animals_update_authenticated" ON public.animals`,
  },
  // 3. profiles に is_admin カラムを追加
  {
    label: 'ALTER TABLE profiles ADD COLUMN is_admin',
    sql: `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE`,
  },
  // 4. SECURITY DEFINER 関数: RLS 内から profiles を安全に参照
  {
    label: 'CREATE FUNCTION is_admin()',
    sql: `
      CREATE OR REPLACE FUNCTION public.is_admin()
      RETURNS BOOLEAN
      LANGUAGE SQL
      SECURITY DEFINER
      STABLE
      SET search_path = public
      AS $$
        SELECT COALESCE(
          (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
          FALSE
        )
      $$
    `,
  },
  // 5. animals: 本人または管理者のみ UPDATE できる新ポリシー
  {
    label: 'CREATE POLICY: animals_update_owner_or_admin',
    sql: `
      CREATE POLICY "animals_update_owner_or_admin" ON public.animals
        FOR UPDATE
        USING (auth.uid() = user_id OR public.is_admin())
    `,
  },
];

for (const step of steps) {
  try {
    await c.query(step.sql);
    console.log(`  ✅ ${step.label}`);
  } catch (e) {
    console.error(`  ❌ ${step.label}: ${e.message}`);
  }
}

// 確認: posts ポリシー
const { rows: posts } = await c.query(`
  SELECT policyname, cmd, qual, with_check
  FROM pg_policies WHERE tablename = 'posts'
  ORDER BY cmd, policyname
`);
console.log('\n=== posts ポリシー最終確認 ===');
console.table(posts);

// 確認: animals ポリシー
const { rows: animals } = await c.query(`
  SELECT policyname, cmd, qual, with_check
  FROM pg_policies WHERE tablename = 'animals'
  ORDER BY cmd, policyname
`);
console.log('\n=== animals ポリシー最終確認 ===');
console.table(animals);

// 確認: profiles カラム
const { rows: cols } = await c.query(`
  SELECT column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles'
    AND column_name = 'is_admin'
`);
console.log('\n=== profiles.is_admin カラム ===');
console.table(cols);

await c.end();
console.log('\n✅ 完了');
