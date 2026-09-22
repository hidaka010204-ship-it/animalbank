import pg from 'pg';
const { Client } = pg;
const c = new Client({ connectionString: process.argv[2], ssl: { rejectUnauthorized: false } });
await c.connect();

const ids = ['fcc340bd-ffec-4f6e-a171-9adb1adee1c4', '2ff3d2eb-5c9c-48f9-90a6-d076040dc6e5'];
const { rows } = await c.query(
  `SELECT id, name, images, prefecture, shelter FROM public.animals WHERE id = ANY($1)`,
  [ids]
);
console.log('\n=== 動物画像確認 ===');
for (const r of rows) {
  console.log(`\nID: ${r.id}`);
  console.log(`名前: ${r.name}`);
  console.log(`prefecture: ${r.prefecture}`);
  console.log(`shelter: ${r.shelter}`);
  console.log(`images type: ${typeof r.images} / isArray: ${Array.isArray(r.images)}`);
  console.log(`images value:`, JSON.stringify(r.images));
}
await c.end();
