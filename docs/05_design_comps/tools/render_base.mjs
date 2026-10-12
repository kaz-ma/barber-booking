// Render + verify the base comps (DG-001). Usage: node render_base.mjs <outDir>
// - 390x844 @3x: full-page PNG for 01/02, viewport PNG for 03; 1280 desktop for 01
// - checks fonts (document.fonts.check + loaded FontFace), scrollWidth at 390/320, done height,
//   44px targets, and dumps every text/UI colour pair to <outDir>/audit.json for contrast_check_base.py
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const dir = '/home/user/barber-booking/docs/05_design_comps/base';
const out = process.argv[2];
const pages = [['01_top', true], ['02_time', true], ['03_done', false]];
const browser = await chromium.launch();
const report = { pages: {} };

async function open(ctx, n) {
  const page = await ctx.newPage();
  await page.goto(`file://${dir}/${n}.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return page;
}
const fontCheck = (page) => page.evaluate(() => ({
  lato400: document.fonts.check('400 16px Lato'), lato700: document.fonts.check('700 16px Lato'),
  noto: document.fonts.check('400 16px "Noto Sans JP"', '予約'), noto700: document.fonts.check('700 16px "Noto Sans JP"', '予約'),
  loaded: [...new Set([...document.fonts].filter(f => f.status === 'loaded').map(f => `${f.family} ${f.weight}`))],
}));

// collect colour pairs + targets in the page context
const audit = (page) => page.evaluate(() => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const hex = (o) => '#' + [o.r, o.g, o.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const blend = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  function bgOf(el) { // effective solid background + whether it sits on the paper texture or an image
    const stack = []; let e = el;
    while (e && e.nodeType === 1) {
      const cs = getComputedStyle(e); const c = parse(cs.backgroundColor);
      const img = cs.backgroundImage !== 'none';
      if (img && e.classList.contains('photo')) return { hex: null, onImage: true };
      if (c && c.a > 0) { stack.push(c); if (c.a >= 1) return { hex: hex(stack.reduceRight((acc, t) => blend(t, acc))), paper: img && e.classList.contains('paper') }; }
      e = e.parentElement;
    }
    return { hex: '#ffffff', paper: false };
  }
  const pairs = []; const targets = [];
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || el.closest('svg')) continue;
    const cs = getComputedStyle(el);
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (own) {
      const fg = parse(cs.color); const bg = bgOf(el);
      if (bg.onImage) { pairs.push({ kind: 'image', sel: el.className || el.tagName, text: el.textContent.trim().slice(0, 24) }); continue; }
      const size = parseFloat(cs.fontSize), w = parseInt(cs.fontWeight);
      const large = size >= 24 || (w >= 700 && size >= 18.66);
      pairs.push({ kind: large ? 'large' : 'text', fg: hex(fg), alpha: fg.a, bg: bg.hex, paper: bg.paper, size, w, text: el.textContent.trim().slice(0, 28) });
    }
    const interactive = el.matches('a,button,[role=button]');
    if (interactive) {
      const r = el.getBoundingClientRect();
      targets.push({ text: (el.getAttribute('aria-label') || el.textContent).trim().replace(/\s+/g, ' ').slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) });
      const parentBg = bgOf(el.parentElement);
      const bw = parseFloat(cs.borderTopWidth);
      if (bw > 0 && cs.borderTopStyle !== 'none') pairs.push({ kind: 'ui', fg: hex(parse(cs.borderTopColor)), bg: parentBg.hex, paper: parentBg.paper, text: 'border: ' + el.textContent.trim().slice(0, 20) });
      const own = parse(cs.backgroundColor);
      if (own && own.a >= 1 && hex(own) !== parentBg.hex && bw === 0) pairs.push({ kind: 'ui', fg: hex(own), bg: parentBg.hex, paper: parentBg.paper, text: 'fill: ' + el.textContent.trim().slice(0, 20) });
    }
  }
  for (const svg of document.querySelectorAll('svg.ic')) { // meaningful icons sit next to text; check 3:1 anyway
    if (!visible(svg)) continue; const cs = getComputedStyle(svg); const bg = bgOf(svg.parentElement);
    pairs.push({ kind: 'ui', fg: hex(parse(cs.color)), bg: bg.hex, paper: bg.paper, text: 'icon in ' + svg.parentElement.textContent.trim().slice(0, 16) });
  }
  return { pairs, targets };
});

const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
for (const [n, full] of pages) {
  const page = await open(m, n);
  const r = report.pages[n] = {};
  r.fonts = await fontCheck(page);
  r.scrollWidth390 = await page.evaluate(() => document.documentElement.scrollWidth);
  r.scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  r.contentBottom = await page.evaluate(() => Math.ceil(Math.max(...[...document.body.children].map(e => e.getBoundingClientRect().bottom + parseFloat(getComputedStyle(e).marginBottom || 0)))));
  Object.assign(r, await audit(page));
  await page.screenshot({ path: `${out}/${n}.png`, fullPage: full });
  await page.close();
}
// texture sample: an empty paper strip, 1x, to measure luminance spread
{
  const page = await m.newPage();
  writeFileSync(`${out}/texture.html`, `<!doctype html><html><head><link rel="stylesheet" href="file://${dir}/../tokens.css"></head><body class="paper" style="margin:0;height:844px"></body></html>`);
  await page.goto(`file://${out}/texture.html`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/texture.png` });
  await page.close();
}
// reflow at 320
const s = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 1 });
for (const [n] of pages) { const p = await open(s, n); report.pages[n].scrollWidth320 = await p.evaluate(() => document.documentElement.scrollWidth); await p.screenshot({ path: `${out}/${n}_320.png`, fullPage: true }); await p.close(); }
// reduced motion: computed transition durations on buttons
const rm = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
for (const [n] of pages) { const p = await open(rm, n); report.pages[n].reducedMotion = await p.evaluate(() => { const b = document.querySelector('.btn,.slot'); const cs = getComputedStyle(b); return { transition: cs.transitionDuration, activeTransformRule: [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } }).some(r => r.media && r.media.mediaText.includes('reduce')), animations: document.getAnimations().length }; }); await p.close(); }
// desktop
const d = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
{ const p = await open(d, '01_top'); report.desktopScrollWidth = await p.evaluate(() => document.documentElement.scrollWidth); await p.screenshot({ path: `${out}/01_top_desktop.png`, fullPage: true }); await p.close(); }
writeFileSync(`${out}/audit.json`, JSON.stringify(report, null, 1));
for (const [n, r] of Object.entries(report.pages)) {
  const small = r.targets.filter(t => t.w < 44 || t.h < 44);
  console.log(n, JSON.stringify(r.fonts), 'sw390', r.scrollWidth390, 'sw320', r.scrollWidth320, 'height', r.scrollHeight, 'content', r.contentBottom, 'targets', r.targets.length, 'min', Math.min(...r.targets.map(t => Math.min(t.w, t.h))), small.length ? 'SMALL: ' + JSON.stringify(small) : '', 'RM', JSON.stringify(r.reducedMotion));
}
console.log('desktop sw', report.desktopScrollWidth);
await browser.close();
