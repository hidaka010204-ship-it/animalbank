import pg from 'pg';
const { Client } = pg;
const CONN = process.argv[2];
const c = new Client({ connectionString: CONN, ssl: { rejectUnauthorized: false } });
await c.connect();

// 1. posts の qual=true な UPDATE/DELETE ポリシーを特定
const { rows: bad } = await c.query(`
  SELECT policyname, cmd, qual
  FROM pg_policies
  WHERE tablename = 'posts'
    AND cmd IN ('UPDATE','DELETE')
    AND qual = 'true'
  ORDER BY cmd, policyname
`);
console.log('=== 削除対象ポリシー (posts, qual=true UPDATE/DELETE) ===');
console.table(bad);

// 2. DROP
for (const row of bad) {
  await c.query(`DROP POLICY IF EXISTS "${row.policyname}" ON public.posts`);
  console.log(`  DROP: "${row.policyname}" (${row.cmd})`);
}

// 3. animals ポリシー一覧（削除しない）
const { rows: animals } = await c.query(`
  SELECT policyname, cmd, qual, with_check
  FROM pg_policies WHERE tablename = 'animals'
  ORDER BY cmd, policyname
`);
console.log('\n=== animals ポリシー一覧（参考のみ・削除しない） ===');
console.table(animals);

// 4. posts 最終ポリシー一覧
const { rows: final } = await c.query(`
  SELECT policyname, cmd, qual, with_check
  FROM pg_policies WHERE tablename = 'posts'
  ORDER BY cmd, policyname
`);
console.log('\n=== posts ポリシー最終確認 ===');
console.table(final);

await c.end();
console.log('\n✅ 完了');
