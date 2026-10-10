// Render customer wireframes to PNG and verify layout rules.
// usage (from the repo root): node docs/04_wireframes/tools/render_customer.mjs [name ...]
//   names without .html; default: all customer_0*.html in ../screens
// Then: python3 -I docs/04_wireframes/tools/build_jpg_customer.py
import { readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/opt/node-tools/node_modules/playwright/index.mjs')); }

const DIR = fileURLToPath(new URL('../screens', import.meta.url));
const names = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(DIR).filter(f => /^customer_0\d_.*\.html$/.test(f)).map(f => f.replace(/\.html$/, '')).sort();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1700, height: 900 }, deviceScaleFactor: 1.5, ignoreHTTPSErrors: true });
const report = [];
let failures = 0;

for (const n of names) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`file://${DIR}/${n}.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // columns: up to 3 per row, 4 states as 2x2
  const count = await page.locator('.artboard').count();
  const cols = count <= 3 ? count : count === 4 ? 2 : 3;
  const width = 40 * 2 + cols * 390 + (cols - 1) * 40;
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(() => document.fonts.ready);

  const checks = await page.evaluate(() => {
    const out = { overflow: [], small: [], frames: [], fonts: [], focusableFull: [] };
    document.querySelectorAll('.frame').forEach((f, i) => {
      const title = f.closest('.artboard')?.querySelector('.frame-title')?.firstChild?.textContent?.trim() ?? `#${i}`;
      if (f.scrollWidth > f.clientWidth) out.overflow.push({ title, scrollWidth: f.scrollWidth, clientWidth: f.clientWidth });
      const prev = f.style.minHeight;
      f.style.minHeight = '0';
      const natural = Math.round(f.getBoundingClientRect().height);
      f.style.minHeight = prev;
      out.frames.push({ title, natural });
    });
    const SEL = '.btn,.slot,.radio,.input,.day,.lang,.back,.change';
    document.querySelectorAll(SEL).forEach(el => {
      if (!el.closest('.frame')) return;
      const h = el.getBoundingClientRect().height;
      const min = el.classList.contains('change') ? 24 : 44;
      if (h < min) out.small.push({ cls: el.className, text: el.textContent.trim().slice(0, 30), h: Math.round(h) });
    });
    // × rows / × day cells must not be links, buttons or focusable (CW-10)
    document.querySelectorAll('.slot.full,.day.off').forEach(el => {
      if (el.matches('a,button,[tabindex],[href]') || el.closest('a,button')) out.focusableFull.push(el.textContent.trim().replace(/\s+/g, ' ').slice(0, 30));
    });
    out.targets = [...document.querySelectorAll(SEL)].filter(el => el.closest('.frame')).length;
    out.fonts = [...new Set([...document.fonts].filter(f => f.status === 'loaded').map(f => f.family))];
    return out;
  });
  const done = /_done$/.test(n);
  const tooTall = done ? checks.frames.filter(f => f.natural > 844) : [];
  const ok = !checks.overflow.length && !checks.small.length && !tooTall.length && !checks.focusableFull.length && !errors.length;
  if (!ok) failures++;
  await page.screenshot({ path: `${DIR}/${n}.png`, fullPage: true });
  const entry = { name: n, artboards: count, viewport: width, targets: checks.targets, overflow: checks.overflow, small: checks.small,
    focusableFull: checks.focusableFull, errors, frameHeights: checks.frames.map(f => `${f.title}: ${f.natural}`), doneFrameTooTall: tooTall, fonts: checks.fonts, ok };
  report.push(entry);
  console.log(JSON.stringify(entry));
  await page.close();
}
await browser.close();
writeFileSync(new URL('./verify_report.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(failures ? `FAIL: ${failures} page(s)` : `ALL CHECKS PASSED (${report.length} files)`);
process.exitCode = failures ? 1 : 0;
