import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

await mkdir('tests/screenshots', { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });

// ── 動物情報タブ（admin.tsx 一覧） ──
console.log('動物情報タブ 読み込み中...');
await page.goto('http://localhost:8081/(tabs)/admin', { waitUntil: 'networkidle', timeout: 30000 });
try {
  await page.waitForFunction(() => document.body.innerText.includes('むう') || document.body.innerText.includes('ポン'), { timeout: 15000 });
} catch { console.log('⚠️ データ読み込みタイムアウト'); }
await page.waitForTimeout(2000);
await page.screenshot({ path: 'tests/screenshots/admin_list.png', fullPage: true });
console.log('✅ admin一覧スクリーンショット保存');

const jitaku = await page.locator('text=自宅').count();
console.log(`admin一覧に「自宅」: ${jitaku > 0 ? '❌ 表示されている' : '✅ 表示されていない'}`);
const aichi = await page.locator('text=愛知県').count();
const tokyo = await page.locator('text=東京都').count();
console.log(`愛知県: ${aichi}件, 東京都: ${tokyo}件`);

// ── むう詳細 写真くるくるチェック ──
console.log('\nむう詳細ページ 読み込み中...');
await page.goto('http://localhost:8081/animal/fcc340bd-ffec-4f6e-a171-9adb1adee1c4', { waitUntil: 'networkidle', timeout: 30000 });
// キャッシュ済みの場合も含め、少し待つ
await page.waitForTimeout(3000);
await page.screenshot({ path: 'tests/screenshots/muu_detail_final.png', fullPage: false });
console.log('✅ むう詳細スクリーンショット保存');

// 写真の高さチェック
const heroHeight = await page.evaluate(() => {
  for (const img of document.querySelectorAll('img')) {
    const rect = img.getBoundingClientRect();
    if (rect.width > 200) return rect.height;
  }
  return null;
});
console.log(`写真の高さ: ${heroHeight}px (${heroHeight ? Math.round(heroHeight/900*100) : '?'}%)`);
console.log(`写真が半分以下: ${heroHeight && heroHeight <= 450 ? '✅ OK' : '❌ 超えている'}`);

// くるくる（ActivityIndicator）が見えていないか確認
// WebではActivityIndicatorはrole=progressbarになる
const spinners = await page.locator('[role="progressbar"]').count();
console.log(`写真エリアのくるくる(progressbar): ${spinners}件`);

await browser.close();
console.log('\n完了');
