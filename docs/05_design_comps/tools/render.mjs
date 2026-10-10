import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const dir = '/home/user/barber-booking/docs/05_design_comps/style_tiles';
const out = process.argv[2];
const names = process.argv.slice(3);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
for (const n of names) {
  const page = await ctx.newPage();
  await page.goto(`file://${dir}/${n}.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).filter((v,i,a)=>a.indexOf(v)===i));
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  await page.screenshot({ path: `${out}/${n}.png`, fullPage: true });
  console.log(n, 'fonts:', fonts.join(','), 'scrollWidth:', w);
  await page.close();
}
await browser.close();
