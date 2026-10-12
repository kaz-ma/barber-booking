// Render + verify the expanded customer comps (DG-001 v0.3 → expanded/customer/).
// Usage: node render_expanded_customer.mjs <outDir> [--no-images]
// Same approach as render_base.mjs:
// - 390x844 @3x full-page PNG per page (fonts ready), then JPEG q88 + contact sheet via build_expanded_customer_images.py
// - collects every text / UI-border / icon / fill colour pair (audit.json → contrast_check_expanded.py)
// - structural checks: targets >= 44px, scrollWidth at 390 / 320, x / disabled / inert elements not focusable,
//   form controls labelled (label[for] / wrapping label / aria-label / aria-labelledby),
//   error messages linked via aria-describedby from an aria-invalid control, one h1, no tel: links
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dir = path.join(root, 'expanded/customer');
const out = path.resolve(process.argv[2] || '/tmp/expanded_customer_render');
mkdirSync(out, { recursive: true });
const pages = readdirSync(dir).filter(f => f.endsWith('.html')).sort().map(f => f.replace(/\.html$/, ''));
const browser = await chromium.launch();
const report = { pages: {} };

async function open(ctx, n) {
  const page = await ctx.newPage();
  await page.goto(`file://${dir}/${n}.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  return page;
}
const fontCheck = (page) => page.evaluate(() => { const ja = document.documentElement.lang === 'ja' ? '予約' : '日本語'; return {
  lato400: document.fonts.check('400 16px Lato'), lato700: document.fonts.check('700 16px Lato'),
  noto: document.fonts.check('400 16px "Noto Sans JP"', ja), noto700: document.fonts.check('700 16px "Noto Sans JP"', ja),
  loaded: [...new Set([...document.fonts].filter(f => f.status === 'loaded').map(f => `${f.family} ${f.weight}`))],
}; });

// colour pairs + structure, in the page context
const audit = (page) => page.evaluate(() => {
  const parse = (c) => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const hex = (o) => '#' + [o.r, o.g, o.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const blend = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  function bgOf(el) { // effective solid background + whether it sits on the paper texture
    const stack = []; let e = el;
    while (e && e.nodeType === 1) {
      const cs = getComputedStyle(e); const c = parse(cs.backgroundColor);
      const img = cs.backgroundImage !== 'none';
      if (c && c.a > 0) { stack.push(c); if (c.a >= 1) return { hex: hex(stack.reduceRight((acc, t) => blend(t, acc))), paper: img && e.classList.contains('paper') }; }
      e = e.parentElement;
    }
    return { hex: '#ffffff', paper: false };
  }
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden]'); };
  const isVh = (el) => !!el.closest('.vh');
  const inert = (el) => !!el.closest('[inert]');
  const label = (el) => (el.getAttribute('aria-label') || el.textContent || el.value || el.name || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 32);
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),textarea:not([disabled]),select:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
  const tabbable = (el) => el.matches(FOCUSABLE) && !inert(el) && el.tabIndex >= 0 && visible(el);
  const pairs = [], targets = [], issues = [], info = {};
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || el.closest('svg') || inert(el)) continue;
    const cs = getComputedStyle(el);
    const transparent = parseFloat(cs.opacity) === 0; // hidden native radio / checkbox covering its label: a target, not a colour pair
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (own && !isVh(el) && !transparent) {
      const fg = parse(cs.color); const bg = bgOf(el);
      const size = parseFloat(cs.fontSize), w = parseInt(cs.fontWeight);
      const large = size >= 24 || (w >= 700 && size >= 18.66);
      pairs.push({ kind: large ? 'large' : 'text', fg: hex(fg), alpha: fg.a, bg: bg.hex, paper: bg.paper, size, w, text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 28) });
    }
    if (el.matches('input,textarea') && !['radio', 'checkbox'].includes(el.type)) { // value + placeholder text
      const bg = bgOf(el);
      if (el.value) pairs.push({ kind: 'text', fg: hex(parse(cs.color)), alpha: 1, bg: bg.hex, paper: false, size: parseFloat(cs.fontSize), w: 400, text: 'value: ' + el.value.slice(0, 20) });
      if (!el.value && el.placeholder) { const ps = getComputedStyle(el, '::placeholder'); pairs.push({ kind: 'text', fg: hex(parse(ps.color)), alpha: parse(ps.color).a, bg: bg.hex, paper: false, size: parseFloat(cs.fontSize), w: 400, text: 'placeholder: ' + el.placeholder.slice(0, 16) }); }
    }
    const interactive = el.matches('a[href],button,summary,input:not([type=hidden]),textarea,select');
    if (interactive) {
      const r = el.getBoundingClientRect();
      targets.push({ tag: el.tagName.toLowerCase(), text: label(el), w: Math.round(r.width), h: Math.round(r.height) });
    }
    // UI boundaries: interactive elements and the visible boxes of hidden-input controls
    if (!transparent && (interactive || el.matches('.rcard,.radio,.consent,.rdot,.cbox'))) {
      const parentBg = bgOf(el.parentElement);
      const bw = parseFloat(cs.borderTopWidth);
      if (bw > 0 && cs.borderTopStyle !== 'none') pairs.push({ kind: 'ui', fg: hex(parse(cs.borderTopColor)), bg: parentBg.hex, paper: parentBg.paper, text: 'border: ' + label(el).slice(0, 20) });
      const fill = parse(cs.backgroundColor);
      if (fill && fill.a >= 1 && hex(fill) !== parentBg.hex && bw === 0) pairs.push({ kind: 'ui', fg: hex(fill), bg: parentBg.hex, paper: parentBg.paper, text: 'fill: ' + label(el).slice(0, 20) });
    }
  }
  for (const svg of document.querySelectorAll('svg.ic')) {
    if (!visible(svg) || inert(svg) || getComputedStyle(svg).visibility === 'hidden') continue;
    const cs = getComputedStyle(svg); const bg = bgOf(svg.parentElement);
    pairs.push({ kind: 'ui', fg: hex(parse(cs.color)), bg: bg.hex, paper: bg.paper, text: 'icon in ' + svg.parentElement.textContent.trim().slice(0, 16) });
  }
  // ---- structure ----
  // (1) x / disabled / inert / aria-hidden content must not be tabbable; aria-disabled CTA is focusable by design (FR-C-09)
  const notFocus = [...document.querySelectorAll('[disabled],.x,.is-off,[inert] *,[aria-hidden="true"],[aria-hidden="true"] *,.next,.next *,.turnstile *,.status,.tag,.req')];
  info.nonFocusChecked = notFocus.length;
  for (const el of notFocus) if (tabbable(el)) issues.push({ check: 'focusable-when-unavailable', el: el.tagName + ' ' + label(el) });
  info.ariaDisabled = [...document.querySelectorAll('[aria-disabled="true"]')].map(e => ({ text: label(e), tabbable: tabbable(e) }));
  // (2) labels
  const controls = [...document.querySelectorAll('input:not([type=hidden]),textarea,select')].filter(e => !e.closest('[hidden]'));
  info.controls = controls.length;
  for (const c of controls) {
    const byFor = c.id && document.querySelector(`label[for="${c.id}"]`);
    const wrap = c.closest('label');
    const al = c.getAttribute('aria-label');
    const lb = (c.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean).map(id => document.getElementById(id)).filter(e => e && e.textContent.trim());
    const how = byFor ? 'label[for]' : wrap ? 'label wrap' : al ? 'aria-label' : lb.length ? 'aria-labelledby' : null;
    if (!how) issues.push({ check: 'unlabelled-control', el: c.outerHTML.slice(0, 80) });
  }
  // (3) error messages <-> aria-describedby + aria-invalid
  const errs = [...document.querySelectorAll('.err')];
  info.errors = errs.length;
  for (const e of errs) {
    const ctl = e.id && document.querySelector(`[aria-describedby~="${e.id}"]`);
    if (!ctl) issues.push({ check: 'error-not-described', el: e.textContent.trim().slice(0, 30) });
    else if (ctl.getAttribute('aria-invalid') !== 'true') issues.push({ check: 'error-control-not-invalid', el: label(ctl) });
  }
  for (const c of document.querySelectorAll('[aria-invalid="true"]')) {
    const ids = (c.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (!ids.some(id => document.getElementById(id)?.classList.contains('err'))) issues.push({ check: 'invalid-without-error-text', el: label(c) });
  }
  // every aria-describedby / aria-labelledby / aria-controls id must exist
  for (const el of document.querySelectorAll('[aria-describedby],[aria-labelledby],[aria-controls]'))
    for (const a of ['aria-describedby', 'aria-labelledby', 'aria-controls'])
      for (const id of (el.getAttribute(a) || '').split(/\s+/).filter(Boolean)) if (!document.getElementById(id)) issues.push({ check: 'dangling-' + a, el: id });
  // (4) document-level
  const h1 = [...document.querySelectorAll('h1')]; // inert background of an open dialog still counts
  if (h1.length !== 1) issues.push({ check: 'h1-count', el: String(h1.length) });
  if (!document.documentElement.lang) issues.push({ check: 'no-lang', el: '' });
  if (document.querySelector('a[href^="tel:"]')) issues.push({ check: 'tel-link', el: 'FR-C-16' });
  const dlg = document.querySelector('[role=dialog]');
  if (dlg) { info.dialog = { modal: dlg.getAttribute('aria-modal'), labelled: !!document.getElementById(dlg.getAttribute('aria-labelledby')), autofocus: (dlg.querySelector('[autofocus]') || {}).textContent }; if (dlg.getAttribute('aria-modal') !== 'true' || !info.dialog.labelled || !info.dialog.autofocus) issues.push({ check: 'dialog', el: JSON.stringify(info.dialog) }); }
  info.text = document.body.innerText;
  return { pairs, targets, issues, info };
});

const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
for (const n of pages) {
  const page = await open(m, n);
  const r = report.pages[n] = {};
  r.fonts = await fontCheck(page);
  r.scrollWidth390 = await page.evaluate(() => document.documentElement.scrollWidth);
  r.scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  r.overflow390 = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => { const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 0.5 || b.left < -0.5) && !e.closest('.vh'); }).map(e => e.tagName + '.' + e.className).slice(0, 5));
  Object.assign(r, await audit(page));
  // full page: stretch the viewport to the document height so the sticky CTA bar (position: sticky; bottom: 0)
  // is drawn where it rests at the end of the page instead of being pinned over the content at 844px
  const fullH = Math.max(844, r.scrollHeight);
  await page.setViewportSize({ width: 390, height: fullH });
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${out}/${n}.png` });
  await page.close();
}
// texture sample (empty paper, 1x) for the darkest-pixel rule
{
  const page = await m.newPage();
  writeFileSync(`${out}/texture.html`, `<!doctype html><html><head><link rel="stylesheet" href="file://${root}/tokens.css"></head><body class="paper" style="margin:0;height:844px"></body></html>`);
  await page.goto(`file://${out}/texture.html`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/texture.png` });
  await page.close();
}
// reflow at 320
const s = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 1 });
for (const n of pages) {
  const p = await open(s, n);
  report.pages[n].scrollWidth320 = await p.evaluate(() => document.documentElement.scrollWidth);
  report.pages[n].overflow320 = await p.evaluate(() => [...document.querySelectorAll('body *')].filter(e => { const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 0.5 || b.left < -0.5) && !e.closest('.vh'); }).map(e => e.tagName + '.' + e.className).slice(0, 5));
  report.pages[n].targets320 = await p.evaluate(() => [...document.querySelectorAll('a[href],button,summary,input:not([type=hidden]),textarea')].filter(e => { const b = e.getBoundingClientRect(); return b.width && !e.closest('[hidden],[inert]'); }).map(e => { const b = e.getBoundingClientRect(); return Math.round(Math.min(b.width, b.height)); }).reduce((a, b) => Math.min(a, b), 999));
  await p.screenshot({ path: `${out}/${n}_320.png`, fullPage: true });
  await p.close();
}
// reduced motion
const rm = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
for (const n of pages) { const p = await open(rm, n); report.pages[n].reducedMotion = await p.evaluate(() => { const b = document.querySelector('.btn'); return { transition: getComputedStyle(b).transitionDuration, animations: document.getAnimations().length }; }); await p.close(); }
writeFileSync(`${out}/audit.json`, JSON.stringify(report, null, 1));
await browser.close();

for (const [n, r] of Object.entries(report.pages)) {
  const small = r.targets.filter(t => t.w < 44 || t.h < 44);
  console.log(n.padEnd(24), 'fonts', r.fonts.lato700 && r.fonts.noto700 ? 'ok' : 'NG', 'sw390', r.scrollWidth390, 'sw320', r.scrollWidth320, 'h', r.scrollHeight,
    'targets', r.targets.length, 'min', Math.min(...r.targets.map(t => Math.min(t.w, t.h))), 'min320', r.targets320,
    small.length ? 'SMALL ' + JSON.stringify(small) : '', r.issues.length ? 'ISSUES ' + JSON.stringify(r.issues) : '');
}
if (!process.argv.includes('--no-images')) execFileSync('python3', [path.join(here, 'build_expanded_customer_images.py'), out], { stdio: 'inherit' });
