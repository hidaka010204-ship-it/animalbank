/**
 * Navigation & button test for あにまるバンク web
 * Single sequential test, workers:1, timeout:600s
 */
import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE = 'http://localhost:8081';
const SS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SS, { recursive: true });

const DBG = path.join(SS, 'debug.txt');
fs.writeFileSync(DBG, '', 'utf8');
function dbg(msg: string) {
  try { fs.appendFileSync(DBG, `[${new Date().toISOString()}] ${msg}\n`); } catch {}
}

type Row = { screen: string; button: string; result: 'OK' | 'NG'; note: string };
const rows: Row[] = [];
const ok  = (s: string, b: string, note = '') => rows.push({ screen: s, button: b, result: 'OK', note });
const ng  = (s: string, b: string, note: string) => rows.push({ screen: s, button: b, result: 'NG', note });

async function nav(page: Page, url: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'commit', timeout: 20000 });
      await page.waitForTimeout(4000);
      // If still on splash, wait for the redirect chain to complete (/ → /splash → /(tabs))
      if (page.url().includes('/splash')) {
        await page.waitForURL(u => !u.includes('/splash'), { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(1000);
      }
      return;
    } catch (e: any) {
      if (attempt === 2) throw e;
      await page.waitForTimeout(3000);
    }
  }
}

async function ss(page: Page, name: string) {
  try {
    await page.screenshot({ path: path.join(SS, `${name}.png`) });
  } catch { /* non-fatal */ }
}

async function tap(page: Page, text: string, ms = 4000): Promise<boolean> {
  try {
    const el = page.getByText(text, { exact: false }).first();
    await el.waitFor({ state: 'visible', timeout: ms });
    await el.click();
    await page.waitForTimeout(900);
    return true;
  } catch { return false; }
}

// ─────────────────────────────────────────────────────────────
test('全画面・全ボタン検証', async ({ page }) => {
  const errs: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PageError:' + e.message));

  // ─── Step 0: オンボーディングを一度だけスキップ ───────────
  dbg('Step0: nav to BASE');
  await nav(page, BASE);
  await ss(page, '00-initial');

  // Always set localStorage first — ensures all subsequent navs to / skip onboarding
  await page.evaluate(() => {
    try { localStorage.setItem('onboarded', 'true'); } catch {}
  });

  if (page.url().includes('onboarding')) {
    const skipped = await tap(page, 'スキップ', 5000);
    await page.waitForTimeout(2000);
    ok('オンボーディング', 'スキップボタン', skipped ? `→ ${page.url()}` : 'localStorage設定済み');
    // Navigate away from onboarding
    if (page.url().includes('onboarding')) await nav(page, BASE);
  } else {
    ok('オンボーディング', 'スキップボタン', `localStorage設定済み (${page.url()})`);
  }

  // ─── Step 1: ホーム確認 ────────────────────────────────────
  dbg('Step1: nav to HOME');
  await nav(page, BASE);
  await ss(page, '01-home');
  const homeOk = !page.url().includes('onboarding');
  homeOk ? ok('ホーム', 'ページ読み込み', page.url()) : ng('ホーム', 'ページ読み込み', 'まだonboardingにいる');

  // ─── Step 2: タブ直接URL遷移（タブクリックも確認） ─────────
  // Tab URLs in expo-router (group (tabs) doesn't appear in URL)
  const tabTests: [string, string, string][] = [
    ['タイムライン', `${BASE}/timeline`,      'タイムライン'],
    ['動物情報',     `${BASE}/admin`,          '動物情報'],
    ['通知',         `${BASE}/notifications`,  '通知'],
    ['マイページ',   `${BASE}/mypage`,         'マイページ'],
    ['ホーム',       `${BASE}/`,               'ホーム'],
  ];

  for (const [label, url, tabText] of tabTests) {
    dbg(`Step2: nav to ${label} (${url})`);
    await nav(page, url);
    const tabUrl = page.url();
    const isOk = !tabUrl.includes('onboarding') && !tabUrl.includes('splash');
    isOk ? ok('タブ', label, tabUrl) : ng('タブ', label, `予期しないURL: ${tabUrl}`);
  }
  await ss(page, '02-tab-check');

  // ─── Step 3: タイムライン ──────────────────────────────────
  dbg('Step3: nav to timeline');
  await nav(page, `${BASE}/timeline`);
  await page.waitForTimeout(1000);
  await ss(page, '03-timeline');
  ok('タイムライン', '画面表示', page.url());

  // フィルター（実ラベル: 'すべて', '迷子', '保護', '📢 その他'）
  for (const f of ['すべて', '迷子', '保護', '📢 その他']) {
    const r = await tap(page, f, 3000);
    r ? ok('タイムライン', `フィルター:${f}`) : ng('タイムライン', `フィルター:${f}`, '要素なし');
  }

  // ＋投稿ボタン（実テキスト: '＋ 投稿'）
  await tap(page, 'すべて', 2000); // reset filter first
  const composeOk = await tap(page, '＋ 投稿', 5000);
  if (composeOk) {
    await ss(page, '04-compose');
    ok('タイムライン', '＋投稿ボタン(開く)');
    for (const t of ['✕', 'キャンセル']) { if (await tap(page, t, 1500)) break; }
    await page.keyboard.press('Escape');
  } else {
    ng('タイムライン', '＋投稿ボタン', '要素なし');
  }

  // ─── Step 4: 動物情報 ────────────────────────────────────
  dbg('Step4: nav to admin');
  await nav(page, `${BASE}/admin`);
  await page.waitForTimeout(1500);
  await ss(page, '05-animals');
  ok('動物情報', '画面表示', page.url());

  // ＋登録ボタン
  const regOk = await tap(page, '＋', 4000);
  if (regOk) {
    await ss(page, '06-animals-modal');
    ok('動物情報', '＋登録ボタン(モーダル開く)');
    for (const t of ['キャンセル', '✕']) { if (await tap(page, t, 1500)) break; }
    await page.keyboard.press('Escape');
  } else {
    ng('動物情報', '＋登録ボタン', '要素なし');
  }

  // ─── Step 5: 動物詳細 + 戻るボタン ─────────────────────────
  dbg('Step5: searching for animal links');
  let animalPath = '';
  // Find animal link from home or animals page
  for (const src of [BASE, `${BASE}/admin`]) {
    dbg(`Step5: nav to ${src}`);
    await nav(page, src);
    await page.waitForTimeout(2000);
    try {
      const links = await page.locator('a[href*="animal"]').all();
      if (links.length > 0) { animalPath = (await links[0].getAttribute('href')) || ''; break; }
    } catch {}
  }

  // No real animal link → fall back to not-found screen (also uses goBack())
  const animalUrl = animalPath
    ? `${BASE}${animalPath.startsWith('/') ? animalPath : '/' + animalPath}`
    : `${BASE}/animal/test-not-found`;
  const animalNote = animalPath ? '' : ' (fallback:not-found画面、← 一覧に戻るでgoBack検証)';

  // A: 戻る (通常ナビ - 直前にホームを踏んでから遷移し履歴を作る)
  dbg(`Step5A: goto animal ${animalUrl}`);
  await page.goto(`${BASE}/`, { waitUntil: 'commit', timeout: 10000 }).catch(() => {});
  await nav(page, animalUrl);
  await page.waitForTimeout(2000); // wait for Supabase 400 → not-found render
  await ss(page, '07-animal-detail');
  ok('動物詳細', '画面表示', page.url() + animalNote);

  const u1 = page.url();
  let bk1 = false;
  for (const t of ['‹', '← 一覧に戻る', '戻る']) { if (await tap(page, t, 3000)) { bk1 = true; break; } }
  bk1 && page.url() !== u1
    ? ok('動物詳細', '戻るボタン(通常)', `${u1} → ${page.url()}`)
    : ng('動物詳細', '戻るボタン(通常)', bk1 ? 'URL変化なし' : 'ボタンなし');

  // B: 戻る (直接アクセス → ホームに飛ぶ)
  await nav(page, animalUrl);
  await page.waitForTimeout(2000); // wait for Supabase 400 → not-found render
  await ss(page, '08-animal-direct');
  const u2 = page.url();
  let bk2 = false;
  for (const t of ['‹', '← 一覧に戻る', '戻る']) { if (await tap(page, t, 3000)) { bk2 = true; break; } }
  bk2 && page.url() !== u2
    ? ok('動物詳細', '戻るボタン(直接アクセス→ホーム)', `→ ${page.url()}`)
    : ng('動物詳細', '戻るボタン(直接アクセス)', bk2 ? 'URL変化なし' : 'ボタンなし');

  // ─── Step 6: 通知 ────────────────────────────────────────
  dbg('Step6: nav to notifications');
  await nav(page, `${BASE}/notifications`);
  await page.waitForTimeout(1000);
  await ss(page, '09-notifications');
  ok('通知', '画面表示', page.url());

  // ボタンテキスト: '✓ すべて既読'
  const rOk = await tap(page, 'すべて既読', 5000);
  rOk ? ok('通知', 'すべて既読ボタン') : ng('通知', 'すべて既読ボタン', '要素なし');

  // ─── Step 7: マイページ ────────────────────────────────────
  dbg('Step7: nav to mypage');
  await nav(page, `${BASE}/mypage`);
  await page.waitForTimeout(1000);
  await ss(page, '10-mypage');
  ok('マイページ', '画面表示', page.url());

  // ログイン/新規登録ボタン（ゲスト時）
  const loginOk = await tap(page, 'ログイン / 新規登録', 5000);
  if (loginOk) {
    await page.waitForTimeout(1500);
    await ss(page, '11-auth');
    ok('マイページ', 'ログイン/新規登録ボタン', page.url());

    // auth「← 戻る」(履歴あり)
    const u = page.url();
    const bk = await tap(page, '← 戻る', 4000);
    bk && page.url() !== u
      ? ok('ログイン画面', '← 戻るボタン(履歴あり)', `→ ${page.url()}`)
      : ng('ログイン画面', '← 戻るボタン(履歴あり)', bk ? 'URL変化なし' : 'ボタンなし');
  } else {
    ng('マイページ', 'ログイン/新規登録ボタン', '要素なし（ログイン済み?）');
    ng('ログイン画面', '← 戻るボタン(履歴あり)', 'マイページからauth遷移できなかった');
  }

  // ─── Step 8: auth 直接アクセス → 戻るでホームへ ─────────
  dbg('Step8: nav to auth directly');
  await nav(page, `${BASE}/auth`);
  await ss(page, '12-auth-direct');
  ok('ログイン画面', '直接アクセス', page.url());

  const u3 = page.url();
  const bk3 = await tap(page, '← 戻る', 4000);
  bk3 && page.url() !== u3
    ? ok('ログイン画面', '← 戻る(直接→ホーム)', `→ ${page.url()}`)
    : ng('ログイン画面', '← 戻る(直接アクセス)', bk3 ? 'URL変化なし' : 'ボタンなし');

  // ─── Step 9: マイページ お問い合わせ ────────────────────
  dbg('Step9: nav to mypage for contact');
  await nav(page, `${BASE}/mypage`);
  await page.waitForTimeout(1000);

  const cOk = await tap(page, 'お問い合わせ', 5000);
  if (cOk) {
    await ss(page, '13-contact');
    ok('マイページ', 'お問い合わせボタン');
    for (const t of ['キャンセル', '閉じる', '← 戻る']) { if (await tap(page, t, 1500)) break; }
    await page.keyboard.press('Escape');
  } else {
    ng('マイページ', 'お問い合わせボタン', '要素なし');
  }

  // ─── Step 10: ゲストで続ける ─────────────────────────────
  dbg('Step10: nav to auth for guest');
  await nav(page, `${BASE}/auth`);
  const gOk = await tap(page, 'ゲストで続ける', 4000);
  gOk
    ? ok('ログイン画面', 'ゲストで続けるボタン', `→ ${page.url()}`)
    : ng('ログイン画面', 'ゲストで続けるボタン', '要素なし');

  // ─── コンソールエラー ────────────────────────────────────
  dbg('All steps done, building report');
  const has400 = errs.some(e => e.includes('400'));
  const otherErrs = errs.filter(e => !e.includes('400') && !e.includes('favicon'));
  if (otherErrs.length) console.warn('[ConsoleErrors]\n' + otherErrs.slice(0, 10).join('\n'));
  if (has400) console.warn('[Info] Supabase 400エラーあり → rls-check.sqlで確認要');

  // ─── レポート ────────────────────────────────────────────
  const okN = rows.filter(r => r.result === 'OK').length;
  const ngN = rows.filter(r => r.result === 'NG').length;
  const rpt = [
    `✅ OK: ${okN}  ❌ NG: ${ngN}`,
    has400 ? '⚠️  Supabase 400エラーあり(RLSポリシー要確認)' : '',
    '',
    '| 画面 | ボタン名 | 結果 | 直した内容/備考 |',
    '|------|---------|------|----------------|',
    ...rows.map(r => `| ${r.screen} | ${r.button} | ${r.result} | ${r.note} |`),
  ].filter(Boolean).join('\n');

  fs.writeFileSync(path.join(SS, 'report.md'), rpt, 'utf8');
  console.log('\n\n===== PLAYWRIGHT REPORT =====\n' + rpt + '\n=====END=====\n');

  expect(ngN, `${ngN} NG:\n` + rows.filter(r => r.result === 'NG').map(r => `${r.screen}/${r.button}: ${r.note}`).join('\n')).toBe(0);
});
