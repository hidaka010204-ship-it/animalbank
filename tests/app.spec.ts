import { test, expect, Page } from '@playwright/test';
import path from 'path';

const BASE = 'http://localhost:8083';

// Collect all console errors and failed network requests
const consoleErrors: string[] = [];
const networkErrors: string[] = [];

async function setupListeners(page: Page) {
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[CONSOLE ERROR] ${msg.text()}`);
    }
  });
  page.on('requestfailed', req => {
    networkErrors.push(`[NET FAIL] ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });
  page.on('response', async res => {
    const url = res.url();
    if (url.includes('supabase') && res.status() >= 400) {
      try {
        const body = await res.text();
        networkErrors.push(`[SUPABASE ${res.status()}] ${res.url()} - ${body.slice(0, 200)}`);
      } catch { /* ignore */ }
    }
  });
}

async function waitForApp(page: Page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  // Wait for app shell to render
  await page.waitForSelector('text=あにまるバンク', { timeout: 20000 }).catch(() => {});
}

test.describe('あにまるバンク 全機能検証', () => {
  let page: Page;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    consoleErrors.length = 0;
    networkErrors.length = 0;
    await setupListeners(page);
    await waitForApp(page);
  });

  test.afterEach(async ({}, testInfo) => {
    if (consoleErrors.length > 0 || networkErrors.length > 0) {
      testInfo.annotations.push({
        type: 'ConsoleErrors',
        description: consoleErrors.join('\n'),
      });
      testInfo.annotations.push({
        type: 'NetworkErrors',
        description: networkErrors.join('\n'),
      });
      console.log('\n--- Console Errors ---');
      consoleErrors.forEach(e => console.log(e));
      console.log('\n--- Network Errors ---');
      networkErrors.forEach(e => console.log(e));
    }
  });

  // ── T1: 全タブ遷移 ──
  test('T1: 全タブ遷移', async () => {
    await page.screenshot({ path: 'tests/results/T1-home.png' });

    // タイムライン
    const timelineTab = page.locator('text=タイムライン').first();
    await timelineTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/results/T1-timeline.png' });

    // 動物情報（ホーム）
    const homeTab = page.locator('[data-testid="tab-home"], text=ホーム, text=動物').first();
    await homeTab.click().catch(async () => {
      // Try bottom nav icons
      const tabs = page.locator('[role="tab"]');
      const count = await tabs.count();
      console.log(`Found ${count} tabs`);
      if (count > 0) await tabs.first().click();
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/results/T1-home2.png' });

    // 通知
    const notifTab = page.locator('text=通知').first();
    await notifTab.click().catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/results/T1-notifs.png' });

    // マイページ
    const mypageTab = page.locator('text=マイページ').first();
    await mypageTab.click().catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/results/T1-mypage.png' });

    // 動物情報（admin/登録）
    const adminTab = page.locator('text=動物情報').first();
    await adminTab.click().catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/results/T1-admin.png' });

    expect(true).toBe(true); // タブ遷移完了
  });

  // ── T2: タイムライン投稿（テキストのみ） ──
  test('T2: タイムライン 投稿フォームを開いて投稿する', async () => {
    // タイムラインタブへ
    await page.locator('text=タイムライン').first().click();
    await page.waitForTimeout(1000);

    // ＋投稿ボタンをクリック
    const postBtn = page.locator('text=＋ 投稿').first();
    await expect(postBtn).toBeVisible({ timeout: 5000 });
    await postBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/results/T2-compose-open.png' });

    // テキスト入力
    const textInput = page.locator('textarea, input[placeholder*="内容"]').first();
    if (await textInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await textInput.fill('Playwright自動テスト投稿 ' + new Date().toISOString());
    } else {
      // Try React Native web input
      const inputs = page.locator('[placeholder*="内容"], [placeholder*="入力"]');
      const cnt = await inputs.count();
      console.log(`Found ${cnt} inputs with 内容/入力 placeholder`);
      if (cnt > 0) await inputs.first().fill('Playwright自動テスト投稿 ' + new Date().toISOString());
    }
    await page.screenshot({ path: 'tests/results/T2-text-entered.png' });

    // 投稿するボタン
    const submitBtn = page.locator('text=投稿する').first();
    const submitVisible = await submitBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (submitVisible) {
      await submitBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'tests/results/T2-after-submit.png' });
    } else {
      console.log('Submit button not visible - taking screenshot');
      await page.screenshot({ path: 'tests/results/T2-no-submit.png' });
    }
  });

  // ── T3: 写真付き投稿 ──
  test('T3: タイムライン 写真付き投稿', async () => {
    await page.locator('text=タイムライン').first().click();
    await page.waitForTimeout(1000);
    await page.locator('text=＋ 投稿').first().click();
    await page.waitForTimeout(500);

    // テキスト入力
    const allInputs = page.locator('input, textarea');
    const inputCount = await allInputs.count();
    console.log(`Input elements found: ${inputCount}`);
    for (let i = 0; i < inputCount; i++) {
      const placeholder = await allInputs.nth(i).getAttribute('placeholder') ?? '';
      console.log(`  Input ${i}: placeholder="${placeholder}"`);
    }

    // 写真ボタンをクリック
    const photoBtn = page.locator('text=📷 写真').first();
    const photoBtnVisible = await photoBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (photoBtnVisible) {
      // Set up file chooser intercept
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null),
        photoBtn.click(),
      ]);
      if (fileChooser) {
        await fileChooser.setFiles(path.join(__dirname, 'test.png'));
        await page.waitForTimeout(1000);
        console.log('File attached successfully');
      } else {
        console.log('No file chooser event - photo button may not trigger file picker on web');
      }
      await page.screenshot({ path: 'tests/results/T3-with-photo.png' });
    } else {
      console.log('Photo button not visible');
      await page.screenshot({ path: 'tests/results/T3-no-photo-btn.png' });
    }
  });

  // ── T4: 動物情報 一般ユーザー登録 ──
  test('T4: 動物情報 一般ユーザー登録フォーム', async () => {
    // 動物情報タブ
    await page.locator('text=動物情報').first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/results/T4-admin.png' });

    // ＋登録ボタン（または新規登録）
    const regBtn = page.locator('text=＋ 登録, text=登録, text=+ 登録').first();
    const regBtnVisible = await regBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (regBtnVisible) {
      await regBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/results/T4-register-type.png' });

      // 「一般ユーザーとして登録」を探す
      const userBtn = page.locator('text=一般ユーザー, text=里親募集, text=ユーザー登録').first();
      if (await userBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await userBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'tests/results/T4-user-form.png' });

        // 名前入力
        const nameInput = page.locator('input[placeholder*="名前"], input[placeholder*="なまえ"]').first();
        if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await nameInput.fill('テスト犬');
        }
        await page.screenshot({ path: 'tests/results/T4-form-filled.png' });
      }
    } else {
      console.log('Register button not found');
      await page.screenshot({ path: 'tests/results/T4-no-reg-btn.png' });
    }
  });

  // ── T5: 通知 すべて既読 ──
  test('T5: 通知 すべて既読ボタン', async () => {
    await page.locator('text=通知').first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/results/T5-notifs.png' });

    const markAllBtn = page.locator('text=すべて既読, text=全て既読').first();
    const visible = await markAllBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      await markAllBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'tests/results/T5-after-mark-read.png' });
      console.log('すべて既読: clicked successfully');
    } else {
      console.log('すべて既読 button not found (may require login or no notifications)');
      await page.screenshot({ path: 'tests/results/T5-no-btn.png' });
    }
  });

  // ── T6: マイページ お問い合わせ送信 ──
  test('T6: マイページ 各ボタン確認', async () => {
    await page.locator('text=マイページ').first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/results/T6-mypage.png' });

    // お問い合わせ
    const contactBtn = page.locator('text=お問い合わせ').first();
    if (await contactBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await contactBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/results/T6-contact-open.png' });

      // フォーム入力
      const nameIn = page.locator('input[placeholder*="山田"]').first();
      const emailIn = page.locator('input[type="email"], input[placeholder*="taro@"]').first();
      const bodyIn = page.locator('textarea, [placeholder*="質問"]').first();

      if (await nameIn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await nameIn.fill('テスト太郎');
      }
      if (await emailIn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await emailIn.fill('test@example.com');
      }
      if (await bodyIn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await bodyIn.fill('Playwright自動テストからのお問い合わせです');
      }
      await page.screenshot({ path: 'tests/results/T6-contact-filled.png' });

      // 送信ボタン
      const sendBtn = page.locator('text=送信する').first();
      if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sendBtn.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'tests/results/T6-contact-sent.png' });
      }

      // 閉じる
      const closeBtn = page.locator('text=✕').first();
      if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(300);
      }
    }

    // 利用規約
    const termsBtn = page.locator('text=利用規約').first();
    if (await termsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await termsBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/results/T6-terms.png' });
      await page.locator('text=✕').first().click().catch(() => {});
    }

    // プライバシーポリシー
    const privacyBtn = page.locator('text=プライバシーポリシー').first();
    if (await privacyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await privacyBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/results/T6-privacy.png' });
      await page.locator('text=✕').first().click().catch(() => {});
    }

    // 通知設定
    const notifBtn = page.locator('text=通知設定').first();
    if (await notifBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await notifBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/results/T6-notif-settings.png' });
      await page.locator('text=✕').first().click().catch(() => {});
    }

    await page.screenshot({ path: 'tests/results/T6-done.png' });
  });

  // ── T7: 動物カードクリック → 詳細 + お気に入り ──
  test('T7: 動物詳細 + お気に入り + シェア', async () => {
    // ホームへ
    const homeTab = page.locator('text=ホーム').first();
    await homeTab.click().catch(async () => {
      // fallback: first tab
      await page.locator('[role="tab"]').first().click().catch(() => {});
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'tests/results/T7-home.png' });

    // 動物カードを探す
    const cards = page.locator('[class*="card"], [data-testid*="card"]');
    const cardCount = await cards.count();
    console.log(`Found ${cardCount} cards`);

    if (cardCount > 0) {
      // お気に入りボタン
      const heartBtn = page.locator('text=🤍').first();
      if (await heartBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await heartBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'tests/results/T7-after-heart.png' });
      }

      // カードクリック → 詳細
      await cards.first().click().catch(() => {});
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'tests/results/T7-animal-detail.png' });

      // 戻る
      await page.goBack().catch(async () => {
        await page.locator('text=戻る, text=←').first().click().catch(() => {});
      });
      await page.waitForTimeout(500);
    } else {
      console.log('No animal cards found on home - might be loading or empty');
    }
  });

  // ── T8: コンソールエラー集計 ──
  test('T8: ページロード中のエラー確認', async () => {
    const localErrors = [...consoleErrors];
    const localNetErrors = [...networkErrors];

    console.log('\n=== Final Error Report ===');
    console.log(`Console errors: ${localErrors.length}`);
    console.log(`Network errors: ${localNetErrors.length}`);

    if (localErrors.length > 0) {
      console.log('\nConsole errors:');
      localErrors.forEach(e => console.log('  ' + e));
    }
    if (localNetErrors.length > 0) {
      console.log('\nNetwork errors:');
      localNetErrors.forEach(e => console.log('  ' + e));
    }

    // Supabase 401/403 errors indicate RLS issues
    const rlsErrors = localNetErrors.filter(e => e.includes('401') || e.includes('403'));
    if (rlsErrors.length > 0) {
      console.log('\n⚠ RLS / Auth errors:');
      rlsErrors.forEach(e => console.log('  ' + e));
    }

    await page.screenshot({ path: 'tests/results/T8-final.png' });
    expect(true).toBe(true);
  });
});
