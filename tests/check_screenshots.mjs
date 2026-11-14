import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

await mkdir('tests/screenshots', { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });

// ── ホーム一覧 ──
console.log('ホーム一覧 読み込み中...');
await page.goto('http://localhost:8081/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: 'tests/screenshots/home_list.png', fullPage: false });
console.log('✅ ホーム一覧 スクリーンショット保存');

// 「自宅」が一覧に出ていないか確認
const hasJitaku = await page.locator('text=自宅').count();
console.log(`一覧に「自宅」: ${hasJitaku > 0 ? '❌ 表示されている' : '✅ 表示されていない'}`);

// 地域未設定が出ているか
const unset = await page.locator('text=地域未設定').count();
console.log(`「地域未設定」: ${unset > 0 ? `✅ ${unset}件表示` : 'なし'}`);

// ── むうの詳細ページ ──
console.log('\nむうの詳細ページ 読み込み中...');
await page.goto('http://localhost:8081/animal/fcc340bd-ffec-4f6e-a171-9adb1adee1c4', { waitUntil: 'networkidle', timeout: 30000 });

// 写真の読み込み完了を待つ（ActivityIndicatorが消えるか、imgが表示されるまで）
try {
  await page.waitForFunction(() => {
    const imgs = document.querySelectorAll('img');
    return Array.from(imgs).some(img => img.complete && img.naturalWidth > 0);
  }, { timeout: 15000 });
  console.log('✅ 写真読み込み完了');
} catch {
  console.log('⚠️ 写真の読み込み確認タイムアウト（スクリーンショットは撮る）');
}
await page.waitForTimeout(1500);
await page.screenshot({ path: 'tests/screenshots/muu_detail.png', fullPage: false });
console.log('✅ むう詳細 スクリーンショット保存');

// 写真の高さを確認
const heroHeight = await page.evaluate(() => {
  const imgs = document.querySelectorAll('img');
  for (const img of imgs) {
    const rect = img.getBoundingClientRect();
    if (rect.width > 200) return rect.height;
  }
  return null;
});
const vpHeight = 900;
console.log(`写真の高さ: ${heroHeight}px / viewport: ${vpHeight}px (${heroHeight ? Math.round(heroHeight/vpHeight*100) : '?'}%)`);
if (heroHeight) {
  console.log(`写真が画面の半分以下: ${heroHeight <= vpHeight * 0.5 ? '✅ OK' : '❌ 超えている'}`);
}

// 戻るボタンが見えているか
const backVisible = await page.locator('text=‹').first().isVisible().catch(() => false);
console.log(`戻るボタン表示: ${backVisible ? '✅ 見える' : '❌ 隠れている'}`);

await browser.close();
console.log('\n完了');
