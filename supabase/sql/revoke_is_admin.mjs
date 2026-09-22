import pg from 'pg';
const { Client } = pg;
const c = new Client({ connectionString: process.argv[2], ssl: { rejectUnauthorized: false } });
await c.connect();

try {
  await c.query(`REVOKE UPDATE (is_admin) ON public.profiles FROM authenticated`);
  console.log('✅ REVOKE UPDATE (is_admin) ON profiles FROM authenticated 完了');
} catch (e) {
  console.error('❌', e.message);
}

await c.end();
