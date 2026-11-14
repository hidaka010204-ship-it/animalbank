/**
 * Supabase RLS + Storage の検証スクリプト（ブラウザ不要）
 * node tests/supabase-check.mjs
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const URL = 'https://pxscjvrpopzwhxbzstmj.supabase.co';
const KEY = 'sb_publishable_r5uI_LZzD6wFO_6jebfuPg_k1dTVnJd';

const supabase = createClient(URL, KEY);

const results = [];
function log(op, status, detail, fix = '-') {
  const icon = status === 'OK' ? '✅' : status === 'WARN' ? '⚠' : '❌';
  const row = { op, result: `${icon} ${detail}`, fix };
  results.push(row);
  console.log(`[${status}] ${op}: ${detail}`);
}

// 1. posts SELECT (匿名)
console.log('\n=== 1. posts テーブル SELECT (匿名) ===');
{
  const { data, error } = await supabase.from('posts').select('id, content, created_at').limit(3);
  if (error) {
    log('posts SELECT (匿名)', 'NG', `エラー: ${error.message} (code=${error.code})`, 'posts SELECT RLS ポリシー確認');
  } else {
    log('posts SELECT (匿名)', 'OK', `${data.length} 件取得`);
  }
}

// 2. posts INSERT (匿名 = 未ログイン)
console.log('\n=== 2. posts INSERT (匿名) ===');
{
  const { data, error } = await supabase.from('posts').insert({
    type: 'other',
    content: 'RLS_TEST_' + Date.now(),
    user_nickname: 'テスト',
    user_avatar: '🐾',
    user_id: null,
  }).select('id').single();
  if (error) {
    log('posts INSERT (匿名)', 'NG', `エラー: ${error.message} (code=${error.code})`, 'posts INSERT RLS を匿名許可に変更');
  } else {
    log('posts INSERT (匿名)', 'OK', `挿入成功 id=${data?.id}`);
    // cleanup
    if (data?.id) {
      await supabase.from('posts').delete().eq('id', data.id);
    }
  }
}

// 3. animals SELECT (匿名)
console.log('\n=== 3. animals SELECT (匿名) ===');
{
  const { data, error } = await supabase.from('animals').select('id, name').limit(3);
  if (error) {
    log('animals SELECT (匿名)', 'NG', `エラー: ${error.message}`, 'animals SELECT RLS 確認');
  } else {
    log('animals SELECT (匿名)', 'OK', `${data.length} 件取得`);
  }
}

// 4. animals INSERT (匿名)
console.log('\n=== 4. animals INSERT (匿名) ===');
{
  const { data, error } = await supabase.from('animals').insert({
    name: 'RLSテスト犬_' + Date.now(),
    species: 'dog',
    status: 'available',
    source: 'public',
    user_id: null,
  }).select('id').single();
  if (error) {
    log('animals INSERT (匿名)', 'NG', `エラー: ${error.message} (code=${error.code})`, 'animals INSERT RLS を匿名許可に変更');
  } else {
    log('animals INSERT (匿名)', 'OK', `挿入成功 id=${data?.id}`);
    if (data?.id) {
      await supabase.from('animals').delete().eq('id', data.id);
    }
  }
}

// 5. contacts INSERT (匿名)
console.log('\n=== 5. contacts INSERT (匿名) ===');
{
  const { data, error } = await supabase.from('contacts').insert({
    name: 'テスト',
    email: 'test@example.com',
    body: 'RLSテスト',
  }).select('id').single();
  if (error) {
    log('contacts INSERT (匿名)', 'NG', `エラー: ${error.message}`, 'contacts INSERT RLS を匿名許可に変更');
  } else {
    log('contacts INSERT (匿名)', 'OK', `挿入成功 id=${data?.id}`);
    if (data?.id) await supabase.from('contacts').delete().eq('id', data.id);
  }
}

// 6. Storage: post-images バケット アップロード (匿名)
console.log('\n=== 6. post-images Storage アップロード (匿名) ===');
{
  const testContent = new Uint8Array([137, 80, 78, 71]); // PNG header
  const path = `rls-test-${Date.now()}/0.jpg`;
  const { data, error } = await supabase.storage.from('post-images').upload(path, testContent, { contentType: 'image/jpeg', upsert: true });
  if (error) {
    log('post-images アップロード (匿名)', 'NG', `エラー: ${error.message}`, 'post-images バケットのポリシーで匿名INSERT許可');
  } else {
    log('post-images アップロード (匿名)', 'OK', `アップロード成功 path=${data?.path}`);
    await supabase.storage.from('post-images').remove([path]);
  }
}

// 7. Storage: animal-images バケット アップロード (匿名)
console.log('\n=== 7. animal-images Storage アップロード (匿名) ===');
{
  const testContent = new Uint8Array([137, 80, 78, 71]);
  const path = `rls-test-${Date.now()}/0.jpg`;
  const { data, error } = await supabase.storage.from('animal-images').upload(path, testContent, { contentType: 'image/jpeg', upsert: true });
  if (error) {
    log('animal-images アップロード (匿名)', 'NG', `エラー: ${error.message}`, 'animal-images バケットのポリシーで匿名INSERT許可');
  } else {
    log('animal-images アップロード (匿名)', 'OK', `アップロード成功 path=${data?.path}`);
    await supabase.storage.from('animal-images').remove([path]);
  }
}

// 8. posts UPDATE (匿名 = images更新)
console.log('\n=== 8. posts UPDATE images (匿名) ===');
{
  // まず INSERT してからUPDATEを試みる
  const { data: inserted, error: insertErr } = await supabase.from('posts').insert({
    type: 'other',
    content: 'UPDATE_TEST_' + Date.now(),
    user_id: null,
  }).select('id').single();

  if (insertErr) {
    log('posts UPDATE images (匿名)', 'SKIP', `前提のINSERTが失敗: ${insertErr.message}`, '-');
  } else {
    const { data: updated, error: updateErr } = await supabase.from('posts')
      .update({ images: ['https://example.com/test.jpg'] })
      .eq('id', inserted.id)
      .select('id, images');

    if (updateErr) {
      log('posts UPDATE images (匿名)', 'NG', `エラー: ${updateErr.message}`, 'posts UPDATE RLS を匿名許可に変更（画像URL保存に必要）');
    } else if (!updated || updated.length === 0) {
      log('posts UPDATE images (匿名)', 'NG', '0件更新（RLSでブロック）', 'posts UPDATE RLS: user_id IS NULL の行も更新許可にする');
    } else {
      log('posts UPDATE images (匿名)', 'OK', `更新成功 images=${JSON.stringify(updated[0]?.images)}`);
    }
    // cleanup
    await supabase.from('posts').delete().eq('id', inserted.id);
  }
}

// 9. notifications テーブル確認
console.log('\n=== 9. notifications SELECT (匿名) ===');
{
  const { data, error } = await supabase.from('notifications').select('id').limit(1);
  if (error) {
    log('notifications SELECT (匿名)', 'NG', `エラー: ${error.message}`, 'RLS確認');
  } else {
    log('notifications SELECT (匿名)', 'OK', `${data.length} 件`);
  }
}

// === Summary ===
console.log('\n\n===== 検証結果サマリー =====');
console.log('| 操作 | 結果 | 対処 |');
console.log('|------|------|------|');
for (const r of results) {
  console.log(`| ${r.op} | ${r.result} | ${r.fix} |`);
}

// Count
const ok = results.filter(r => r.result.includes('✅')).length;
const ng = results.filter(r => r.result.includes('❌')).length;
const warn = results.filter(r => r.result.includes('⚠')).length;
console.log(`\n✅ OK: ${ok}  ❌ NG: ${ng}  ⚠ WARN: ${warn}`);

fs.writeFileSync('tests/results/supabase-check.json', JSON.stringify(results, null, 2));
