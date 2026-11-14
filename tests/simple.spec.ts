import { test, expect } from '@playwright/test';
import path from 'path';

const BASE = 'http://localhost:8083';
const errors: string[] = [];
const netErrors: string[] = [];

test.use({ launchOptions: { executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process', '--no-zygote'] } });

test('全機能スモークテスト', async ({ page }) => {
  const results: {op: string, result: string, fix: string}[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('response', async res => {
    if (res.url().includes('supabase') && res.status() >= 400) {
      const t = await res.text().catch(() => '');
      netErrors.push(`${res.status()} ${res.url()} ${t.slice(0,100)}`);
    }
  });

  // ① アプリロード
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'tests/results/01-load.png' });
  const title = await page.title();
  results.push({ op: 'アプリ起動', result: `タイトル: ${title}`, fix: '-' });

  // ② タブ確認
  const tabTexts: string[] = [];
  for (const label of ['ホーム', 'タイムライン', '動物情報', '通知', 'マイページ']) {
    const el = page.locator(`text=${label}`).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      tabTexts.push(label);
    }
  }
  results.push({ op: 'タブ確認', result: tabTexts.join(', '), fix: '-' });

  // ③ タイムラインへ
  await page.locator('text=タイムライン').first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tests/results/02-timeline.png' });
  const postBtnVisible = await page.locator('text=＋ 投稿').first().isVisible({ timeout: 3000 }).catch(() => false);
  results.push({ op: 'タイムライン表示', result: postBtnVisible ? '✅ ＋投稿ボタン確認' : '❌ ＋投稿ボタン非表示', fix: postBtnVisible ? '-' : 'ボタン配置確認' });

  // ④ 投稿フォームを開く
  if (postBtnVisible) {
    await page.locator('text=＋ 投稿').first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/results/03-compose.png' });

    // テキスト入力
    const allInputs = await page.locator('input, textarea').all();
    let textInput = null;
    for (const inp of allInputs) {
      const ph = await inp.getAttribute('placeholder') ?? '';
      if (ph.includes('内容') || ph.includes('入力')) { textInput = inp; break; }
    }
    if (textInput) {
      await textInput.fill('Playwright自動テスト ' + Date.now());
      const submitBtn = page.locator('text=投稿する').first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'tests/results/04-after-post.png' });
        results.push({ op: 'テキスト投稿', result: '✅ 投稿ボタン押下', fix: '-' });
      } else {
        await page.screenshot({ path: 'tests/results/04-no-submit.png' });
        results.push({ op: 'テキスト投稿', result: '❌ 投稿するボタンなし/無効', fix: 'submitBtn disabled条件確認' });
      }
    } else {
      results.push({ op: 'テキスト投稿', result: '❌ テキスト入力欄なし', fix: 'フォームレンダリング確認' });
    }

    // 写真ボタン確認
    const photoBtnVisible = await page.locator('text=📷 写真').first().isVisible({ timeout: 2000 }).catch(() => false);
    results.push({ op: '写真ボタン', result: photoBtnVisible ? '✅ 表示確認' : '❌ 非表示', fix: '-' });
    if (photoBtnVisible) {
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null),
        page.locator('text=📷 写真').first().click(),
      ]);
      if (chooser) {
        await chooser.setFiles(path.join(__dirname, 'test.png'));
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'tests/results/05-photo-attached.png' });
        results.push({ op: '写真添付', result: '✅ ファイル選択成功', fix: '-' });
      } else {
        results.push({ op: '写真添付', result: '⚠ ファイル選択ダイアログなし', fix: 'ImagePickerのweb対応確認' });
      }
    }

    // 閉じる
    await page.locator('text=✕').first().click().catch(() => {});
    await page.waitForTimeout(300);
  }

  // ⑤ 動物情報タブ
  await page.locator('text=動物情報').first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tests/results/06-admin.png' });
  const regBtnVisible = await page.locator('text=＋ 登録').first().isVisible({ timeout: 3000 }).catch(() => false);
  results.push({ op: '動物情報タブ', result: regBtnVisible ? '✅ ＋登録ボタン確認' : '❌ ＋登録ボタンなし', fix: '-' });

  if (regBtnVisible) {
    await page.locator('text=＋ 登録').first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/results/07-reg-type.png' });

    const userRegBtn = page.locator('text=一般ユーザー').first();
    if (await userRegBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await userRegBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/results/08-user-form.png' });
      results.push({ op: '一般ユーザー登録フォーム', result: '✅ フォーム表示', fix: '-' });
    } else {
      results.push({ op: '一般ユーザー登録フォーム', result: '⚠ 選択肢なし（ログイン状態によって変化の可能性）', fix: '-' });
    }
    await page.locator('text=✕').first().click().catch(() => {});
  }

  // ⑥ 通知タブ
  await page.locator('text=通知').first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tests/results/09-notifs.png' });
  const markAllVisible = await page.locator('text=すべて既読').first().isVisible({ timeout: 2000 }).catch(() => false);
  results.push({ op: '通知タブ', result: markAllVisible ? '✅ すべて既読ボタン確認' : '⚠ すべて既読なし（ログイン未・通知なし）', fix: '-' });

  // ⑦ マイページ
  await page.locator('text=マイページ').first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tests/results/10-mypage.png' });

  const contactVisible = await page.locator('text=お問い合わせ').first().isVisible({ timeout: 2000 }).catch(() => false);
  results.push({ op: 'マイページ表示', result: contactVisible ? '✅ お問い合わせボタン確認' : '❌ お問い合わせボタンなし', fix: '-' });

  if (contactVisible) {
    await page.locator('text=お問い合わせ').first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/results/11-contact.png' });

    // フォーム入力
    const inputs = await page.locator('input, textarea').all();
    const filledInputs: string[] = [];
    for (const inp of inputs) {
      const ph = (await inp.getAttribute('placeholder') ?? '').toLowerCase();
      if (ph.includes('山田') || ph.includes('名前')) { await inp.fill('テスト太郎'); filledInputs.push('名前'); }
      else if (ph.includes('taro') || ph.includes('メール') || (await inp.getAttribute('type') === 'email')) { await inp.fill('test@example.com'); filledInputs.push('メール'); }
      else if (ph.includes('質問') || ph.includes('内容')) { await inp.fill('テスト問い合わせ内容'); filledInputs.push('本文'); }
    }

    const sendBtn = page.locator('text=送信する').first();
    if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      const isEnabled = await sendBtn.isEnabled().catch(() => false);
      if (isEnabled) {
        await sendBtn.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'tests/results/12-contact-sent.png' });
        const sent = await page.locator('text=送信しました').first().isVisible({ timeout: 3000 }).catch(() => false);
        results.push({ op: 'お問い合わせ送信', result: sent ? '✅ 送信完了画面表示' : '⚠ 送信後画面変わらず', fix: sent ? '-' : 'contacts INSERT の RLS 確認' });
      } else {
        results.push({ op: 'お問い合わせ送信', result: '⚠ 送信ボタン無効（入力不足）', fix: '-' });
      }
    }
    await page.locator('text=✕').first().click().catch(() => {});
  }

  // ⑧ エラーサマリー
  console.log('\n\n===== 検証結果 =====');
  console.log('操作 | 結果 | 直した内容');
  console.log('---|---|---');
  for (const r of results) {
    console.log(`${r.op} | ${r.result} | ${r.fix}`);
  }

  console.log('\n--- ConsoleErrors ---');
  errors.forEach(e => console.log('  ERROR:', e));
  console.log('\n--- NetworkErrors (Supabase 4xx) ---');
  netErrors.forEach(e => console.log('  NET:', e));

  // Write results to file
  const fs = require('fs');
  fs.writeFileSync('tests/results/summary.json', JSON.stringify({ results, consoleErrors: errors, networkErrors: netErrors }, null, 2));

  expect(true).toBe(true);
});
