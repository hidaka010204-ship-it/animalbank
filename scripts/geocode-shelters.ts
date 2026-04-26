/**
 * shelters テーブルの lat/lng が null の行を国土地理院 API でジオコードして一括更新
 * 実行: npx tsx scripts/geocode-shelters.ts
 * 前提: Node.js 18+（fetch 内蔵）
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { geocodeAddress } from '../lib/geocode';

// ── .env を手動ロード ──────────────────────────────────────────────────────
function loadEnv(): void {
  try {
    const content = readFileSync(resolve(__dirname, '../.env'), 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    console.warn('⚠️  .env の読み込みに失敗しました（ファイルが存在しない可能性があります）');
  }
}

loadEnv();

// ── Supabase クライアント ──────────────────────────────────────────────────
const SUPABASE_URL = 'https://pxscjvrpopzwhxbzstmj.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('❌ EXPO_PUBLIC_SUPABASE_ANON_KEY が .env に見つかりません');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ── メイン処理 ────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('📋 lat/lng が null の保健所を取得中...\n');

  const { data: shelters, error: fetchError } = await supabase
    .from('shelters')
    .select('id, name, address')
    .is('lat', null);

  if (fetchError) {
    console.error('❌ Supabase 取得エラー:', fetchError.message);
    process.exit(1);
  }

  if (!shelters || shelters.length === 0) {
    console.log('✅ lat/lng が null の保健所はありません');
    return;
  }

  console.log(`🔍 ${shelters.length} 件を処理します\n`);

  let success = 0;
  let failed = 0;

  for (const shelter of shelters) {
    const label = `[${shelter.name ?? shelter.id}]`;

    if (!shelter.address) {
      console.log(`⚠️  ${label} address が空のためスキップ`);
      failed++;
      continue;
    }

    const coords = await geocodeAddress(shelter.address);
    if (!coords) {
      console.log(`❌ ${label} ジオコード失敗 — "${shelter.address}"`);
      failed++;
      await sleep(300);
      continue;
    }

    const { error: updateError } = await supabase
      .from('shelters')
      .update({ lat: coords.lat, lng: coords.lng })
      .eq('id', shelter.id);

    if (updateError) {
      console.log(`❌ ${label} DB 更新失敗: ${updateError.message}`);
      failed++;
    } else {
      console.log(`✅ ${label} lat: ${coords.lat.toFixed(4)}, lng: ${coords.lng.toFixed(4)}`);
      success++;
    }

    // 国土地理院 API への過負荷防止
    await sleep(300);
  }

  console.log(`\n📊 完了: 成功 ${success} 件 / 失敗 ${failed} 件 / 合計 ${shelters.length} 件`);
}

main();
