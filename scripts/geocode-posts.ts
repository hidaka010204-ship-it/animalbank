import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { geocodeAddress } from '../lib/geocode';

// ── .env を手動ロード（dotenv 不要） ────────────────────────────────
const envPath = resolve(__dirname, '../.env');
try {
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch {
  // .env がなければ既存の環境変数をそのまま使う
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('環境変数 EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY が未設定です');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const RATE_LIMIT_MS = 200; // GSI API への連続リクエスト間隔

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  // ── 対象レコードを取得 ──────────────────────────────────────────
  const { data: posts, error: fetchError } = await supabase
    .from('posts')
    .select('id, location_prefecture, location_city')
    .is('lat', null)
    .or('location_prefecture.not.is.null,location_city.not.is.null');

  if (fetchError) {
    console.error('取得エラー:', fetchError.message);
    process.exit(1);
  }

  if (!posts || posts.length === 0) {
    console.log('対象レコードなし（lat が NULL かつ住所あり）');
    return;
  }

  console.log(`対象: ${posts.length} 件`);

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const post of posts) {
    const parts = [post.location_prefecture, post.location_city].filter(Boolean);
    if (parts.length === 0) {
      console.log(`  [SKIP] id=${post.id} 住所情報なし`);
      skipped++;
      continue;
    }

    const address = parts.join('');
    const coords = await geocodeAddress(address);

    if (!coords) {
      console.warn(`  [FAIL] id=${post.id}  address="${address}"  → ジオコーディング失敗`);
      failed++;
    } else {
      const { error: updateError } = await supabase
        .from('posts')
        .update({ lat: coords.lat, lng: coords.lng })
        .eq('id', post.id);

      if (updateError) {
        console.error(`  [ERR]  id=${post.id}  address="${address}"  → UPDATE エラー: ${updateError.message}`);
        failed++;
      } else {
        console.log(`  [OK]   id=${post.id}  address="${address}"  → lat=${coords.lat}, lng=${coords.lng}`);
        succeeded++;
      }
    }

    await sleep(RATE_LIMIT_MS);
  }

  console.log(`\n完了: 成功=${succeeded} 失敗=${failed} スキップ=${skipped} / 合計=${posts.length}`);
}

main().catch(e => {
  console.error('予期しないエラー:', e);
  process.exit(1);
});
