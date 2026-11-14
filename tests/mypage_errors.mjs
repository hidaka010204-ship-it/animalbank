import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

await mkdir('tests/screenshots', { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });

const consoleErrors = [];
const pageErrors = [];

page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', err => {
  pageErrors.push(err.message);
});

console.log('/mypage を開く...');
await page.goto('http://localhost:8081/mypage', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

await page.screenshot({ path: 'tests/screenshots/mypage_check.png', fullPage: false });

console.log('\n=== コンソールエラー ===');
if (consoleErrors.length === 0) {
  console.log('なし');
} else {
  consoleErrors.forEach((e, i) => console.log(`[${i+1}] ${e}`));
}

console.log('\n=== ページエラー(pageerror) ===');
if (pageErrors.length === 0) {
  console.log('なし');
} else {
  pageErrors.forEach((e, i) => console.log(`[${i+1}] ${e}`));
}

const bodyText = await page.locator('body').innerText().catch(() => '');
console.log('\nページテキスト(先頭200文字):', bodyText.slice(0, 200));

await browser.close();
console.log('\n完了');
