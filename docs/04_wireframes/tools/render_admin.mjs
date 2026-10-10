// Render admin wireframes to PNG and verify layout rules.
// usage: node render.mjs [filter]
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const DIR = '/home/user/barber-booking/docs/04_wireframes/screens';
const filter = process.argv[2] || '';
const files = readdirSync(DIR).filter(f => /^admin_\d\d_.*\.html$/.test(f) && f.includes(filter)).sort();

const browser = await chromium.launch();
const context = await browser.newContext({ deviceScaleFactor: 1.5, ignoreHTTPSErrors: true, viewport: { width: 1780, height: 900 } });
const report = [];
for (const f of files) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + join(DIR, f), { waitUntil: 'load' });
  // Rendering environment only: this container has no Noto Sans JP; fall back to IPA Gothic for JA glyphs.
  await page.addStyleTag({ content: 'html,body{font-family:"Noto Sans JP","Hiragino Kaku Gothic ProN","IPAPGothic","IPAGothic",sans-serif}' });
  await page.evaluate(() => document.fonts.ready);
  const result = await page.evaluate(() => {
    const desc = el => {
      const fr = el.closest('.artboard')?.querySelector('.frame-title')?.textContent.trim().slice(0, 24) || '?';
      return `[${fr}] .${[...el.classList].join('.')} "${el.textContent.trim().slice(0, 20)}"`;
    };
    const frames = [...document.querySelectorAll('.frame')];
    const overflow = frames.filter(fr => fr.scrollWidth > fr.clientWidth + 1).map(fr => desc(fr) + ` sw=${fr.scrollWidth} cw=${fr.clientWidth}`);
    const small = [...document.querySelectorAll('.btn,.slot,.radio,.input,.tab,.fab,.toggle,.item')]
      .filter(el => el.closest('.frame'))
      .map(el => [el, el.getBoundingClientRect().height])
      .filter(([, h]) => h < 44).map(([el, h]) => desc(el) + ` h=${h.toFixed(1)}`);
    const cards = [...document.querySelectorAll('.booking')]
      .map(el => [el, el.getBoundingClientRect().height])
      .filter(([, h]) => h < 56).map(([el, h]) => desc(el) + ` h=${h.toFixed(1)}`);
    const counts = {
      frames: frames.length,
      interactive: document.querySelectorAll('.frame :is(.btn,.slot,.radio,.input,.tab,.fab,.toggle,.item)').length,
      bookings: document.querySelectorAll('.booking').length,
      notes: document.querySelectorAll('.note').length,
    };
    return { overflow, small, cards, counts };
  });
  const png = join(DIR, f.replace(/\.html$/, '.png'));
  await page.screenshot({ path: png, fullPage: true });
  report.push({ file: f, errors, ...result });
  await page.close();
}
await browser.close();
writeFileSync(new URL('./verify.json', import.meta.url), JSON.stringify(report, null, 2));
let fail = 0;
for (const r of report) {
  const bad = r.overflow.length + r.small.length + r.cards.length + r.errors.length;
  fail += bad;
  console.log(`${bad ? 'FAIL' : 'OK  '} ${r.file} frames=${r.counts.frames} interactive=${r.counts.interactive} bookings=${r.counts.bookings} notes=${r.counts.notes}`);
  for (const k of ['errors', 'overflow', 'small', 'cards']) for (const m of r[k]) console.log(`     ${k}: ${m}`);
}
console.log(fail ? `\nVERIFY: ${fail} issue(s)` : `\nVERIFY: all checks passed (${report.length} files)`);
// PNG -> JPG + contact sheet (python3 PIL)
execFileSync('python3', ['-I', new URL('./post.py', import.meta.url).pathname, DIR], { stdio: 'inherit' });
process.exitCode = fail ? 1 : 0;
