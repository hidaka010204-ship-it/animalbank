import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

await mkdir('tests/screenshots', { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });

console.log('ホーム一覧 読み込み中...');
await page.goto('http://localhost:8081/(tabs)', { waitUntil: 'networkidle', timeout: 30000 });

// Wait for むう or ポン to appear
try {
  await page.waitForFunction(() => {
    return document.body.innerText.includes('むう') || document.body.innerText.includes('ポン');
  }, { timeout: 20000 });
  console.log('✅ 動物データ表示確認');
} catch {
  console.log('⚠️ 動物データ表示タイムアウト');
}

await page.waitForTimeout(3000);

// Full page screenshot
await page.screenshot({ path: 'tests/screenshots/home_list_full.png', fullPage: true });
console.log('✅ フルページスクリーンショット: home_list_full.png');

// Viewport screenshot
await page.screenshot({ path: 'tests/screenshots/home_list_viewport.png', fullPage: false });
console.log('✅ ビューポートスクリーンショット: home_list_viewport.png');

const hasJitaku = await page.locator('text=自宅').count();
console.log(`一覧に「自宅」: ${hasJitaku > 0 ? '❌ 表示されている' : '✅ 表示されていない'}`);

const aichi = await page.locator('text=愛知県').count();
const tokyo = await page.locator('text=東京都').count();
console.log(`愛知県: ${aichi}件, 東京都: ${tokyo}件`);

const unset = await page.locator('text=地域未設定').count();
console.log(`「地域未設定」: ${unset > 0 ? `✅ ${unset}件` : 'なし'}`);

await browser.close();
console.log('完了');
