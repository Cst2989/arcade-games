import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1200, height: 700 });
await page.goto(`file://${join(__dirname, 'generate-og-image.html')}`);
await page.waitForFunction(() => window.__ogReady === true, { timeout: 10000 });
await page.waitForTimeout(300);
const dataUrl = await page.evaluate(() => document.getElementById('c').toDataURL('image/png'));
const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
const outPath = join(__dirname, '..', 'public', 'assets', 'og-image.png');
writeFileSync(outPath, Buffer.from(base64, 'base64'));
console.log(`OG image saved to ${outPath} (${Buffer.from(base64, 'base64').length} bytes)`);
await browser.close();
