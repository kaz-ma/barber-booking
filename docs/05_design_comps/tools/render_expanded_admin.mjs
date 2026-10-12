// Render + verify the expanded admin comps (expanded/admin/*.html). Usage: node render_expanded_admin.mjs <outDir>
// Same approach as render_base.mjs: Playwright Chromium, 390x844 @3x, waits for document.fonts.ready and checks
// Lato / Noto Sans JP. Writes expanded/admin/<page>.jpg (JPEG q88; timeline and long pages = full page, captured by
// growing the viewport to the document height so fixed tab bars / FAB / toasts stay at the bottom) and
// expanded/admin/contact_sheet.jpg (<= 1600px wide, first screen of every page with labels).
// Dumps colour pairs + structural data to <outDir>/audit.json for contrast_check_expanded_admin.py:
//   targets (>= 44px), booking cards (>= 56px), tab bar 72px + safe area, FAB 56px, overflow at 390 / 320,
//   labels on inputs, toasts with role="status", fonts, animations. Elements inside [inert] (behind a scrim) are skipped.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
const dir = '/home/user/barber-booking/docs/05_design_comps/expanded/admin';
const out = process.argv[2];
if (!out) { console.error('usage: node render_expanded_admin.mjs <outDir>'); process.exit(2); }
mkdirSync(out, { recursive: true });
// [file, full-page?, S-A ID, state label]
const pages = [
  ['01_login', false, 'S-A-01', 'ログイン（パスキー）'],
  ['01_login_otp', false, 'S-A-01', 'メールの 6 桁コード'],
  ['01_install', false, 'S-A-12', 'インストール案内（iOS Safari）'],
  ['02_today', true, 'S-A-02', '今日（ライト）'],
  ['02_today_dark', true, 'S-A-02', '今日（ダーク）'],
  ['02_today_empty', true, 'S-A-02', '予約のない日'],
  ['02_today_offline', true, 'S-A-02', 'オフライン（読み取り専用）'],
  ['03_detail', true, 'S-A-04', '予約詳細（確定）'],
  ['03_detail_undo', false, 'S-A-04', '管理者キャンセル直後（Undo）'],
  ['04_manual', true, 'S-A-05', '手動予約（サジェスト）'],
  ['04_manual_overlap', true, 'S-A-05', '重なり警告'],
  ['04_manual_saved', false, 'S-A-05', '保存後の確認 URL'],
  ['05_block', false, 'S-A-06', 'ブロックのシート'],
  ['05_block_toast', true, 'S-A-06', 'ブロック直後（Undo）'],
  ['06_inbox', true, 'S-A-07', '受信箱（未確認 3）'],
  ['06_inbox_empty', false, 'S-A-07', '受信箱（空）'],
  ['07_settings_hours', true, 'S-A-08', '営業時間・休業日'],
  ['07_settings_menus', true, 'S-A-09', 'メニュー一覧'],
  ['07_settings_menu_edit', false, 'S-A-09', 'メニュー編集シート'],
  ['08_notifications', true, 'S-A-10', '通知・端末'],
  ['08_notifications_resubscribe', true, 'S-A-02', '再購読バナー'],
  ['08_notifications_off', true, 'S-A-10', '通知が許可されていない'],
];
const browser = await chromium.launch();
const report = { pages: {} };

async function open(ctx, n) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`file://${dir}/${n}.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  page._errors = errors;
  return page;
}
const fontCheck = (page) => page.evaluate(() => ({
  lato400: document.fonts.check('400 16px Lato'), lato700: document.fonts.check('700 16px Lato'),
  noto: document.fonts.check('400 16px "Noto Sans JP"', '予約'), noto700: document.fonts.check('700 16px "Noto Sans JP"', '予約'),
  loaded: [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`))],
}));

const audit = (page) => page.evaluate(() => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const hex = (o) => '#' + [o.r, o.g, o.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const blend = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  function bgOf(el) {
    const stack = []; let e = el;
    while (e && e.nodeType === 1) {
      const cs = getComputedStyle(e); const c = parse(cs.backgroundColor);
      const img = cs.backgroundImage !== 'none';
      if (c && c.a > 0) { stack.push(c); if (c.a >= 1) return { hex: hex(stack.reduceRight((acc, t) => blend(t, acc))), paper: img && e.classList.contains('paper') }; }
      e = e.parentElement;
    }
    return { hex: '#ffffff', paper: false };
  }
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const isVh = (el) => el.closest('.vh,.vh-input') !== null;
  const theme = document.documentElement.dataset.theme || 'light';
  const pairs = []; const targets = []; let inertSkipped = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg')) continue;
    if (el.closest('[inert]')) { inertSkipped++; continue; }
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (own && !isVh(el)) {
      const fg = parse(cs.color); const bg = bgOf(el);
      const size = parseFloat(cs.fontSize), w = parseInt(cs.fontWeight);
      const large = size >= 24 || (w >= 700 && size >= 18.66);
      pairs.push({ kind: large ? 'large' : 'text', fg: hex(fg), alpha: fg.a, bg: bg.hex, paper: bg.paper, size, w, text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 28) });
    }
    const interactive = el.matches('a[href],button,[role=button],[role=option],[role=link],input,select,textarea');
    if (interactive) {
      const box = el.matches('input[type=checkbox],input[type=radio]') ? (el.closest('label') || el) : el;
      const r = box.getBoundingClientRect();
      const name = (el.getAttribute('aria-label') || box.textContent || el.value || el.id).trim().replace(/\s+/g, ' ').slice(0, 30);
      targets.push({ text: name, tag: el.tagName.toLowerCase(), w: Math.round(r.width), h: Math.round(r.height) });
      if (!el.matches('input[type=checkbox],input[type=radio]')) {
        const parentBg = bgOf(el.parentElement);
        const bw = parseFloat(cs.borderTopWidth);
        if (bw > 0 && cs.borderTopStyle !== 'none') pairs.push({ kind: 'ui', fg: hex(parse(cs.borderTopColor)), bg: parentBg.hex, paper: parentBg.paper, text: 'border: ' + name.slice(0, 20) });
        const ownBg = parse(cs.backgroundColor);
        if (ownBg && ownBg.a >= 1 && hex(ownBg) !== parentBg.hex && !(bw > 0 && cs.borderTopStyle !== 'none')) pairs.push({ kind: 'ui', fg: hex(ownBg), bg: parentBg.hex, paper: parentBg.paper, text: 'fill: ' + name.slice(0, 20) });
      }
    }
  }
  // switch tracks, now line, other non-text UI marked data-ui / .track
  for (const el of document.querySelectorAll('.track,[data-ui]')) {
    if (el.closest('[inert]') || !visible(el)) continue;
    const cs = getComputedStyle(el); const parentBg = bgOf(el.parentElement);
    const bw = parseFloat(cs.borderTopWidth);
    if (bw > 0) pairs.push({ kind: 'ui', fg: hex(parse(cs.borderTopColor)), bg: parentBg.hex, paper: parentBg.paper, text: 'track/ui border' });
    else pairs.push({ kind: 'ui', fg: hex(parse(cs.backgroundColor)), bg: parentBg.hex, paper: parentBg.paper, text: 'ui fill ' + (el.className || '') });
  }
  for (const svg of document.querySelectorAll('svg.ic')) {
    if (svg.closest('[inert]') || !visible(svg)) continue;
    const cs = getComputedStyle(svg); const bg = bgOf(svg.parentElement);
    pairs.push({ kind: 'ui', fg: hex(parse(cs.color)), bg: bg.hex, paper: bg.paper, text: 'icon in ' + svg.parentElement.textContent.trim().slice(0, 16) });
  }
  // structure
  const cards = [...document.querySelectorAll('.bk')].filter((e) => !e.closest('[inert]')).map((e) => Math.round(e.getBoundingClientRect().height));
  const tb = document.querySelector('.tabbar:not([inert] *)');
  const tabbar = tb ? { ul: Math.round(tb.querySelector('ul').getBoundingClientRect().height), padBottom: parseFloat(getComputedStyle(tb).paddingBottom), tabs: [...tb.querySelectorAll('.tab')].map((t) => Math.round(t.getBoundingClientRect().height)) } : null;
  const fabs = [...document.querySelectorAll('.fab')].filter((e) => !e.closest('[inert]')).map((e) => Math.round(e.getBoundingClientRect().height));
  const unlabeled = [...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter((el) => !(el.labels && el.labels.length) && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')).map((el) => el.id || el.name || el.outerHTML.slice(0, 40));
  const toasts = [...document.querySelectorAll('.toast')].map((t) => ({ role: t.getAttribute('role'), live: t.getAttribute('aria-live'), text: t.textContent.trim().replace(/\s+/g, ' ').slice(0, 30) }));
  const alerts = [...document.querySelectorAll('.alert')].map((t) => t.getAttribute('role'));
  const sheets = [...document.querySelectorAll('.sheet')].map((s) => ({ role: s.getAttribute('role'), modal: s.getAttribute('aria-modal'), top: Math.round(s.getBoundingClientRect().top), bottom: Math.round(s.getBoundingClientRect().bottom) }));
  return { theme, pairs, targets, inertSkipped, cards, tabbar, fabs, unlabeled, toasts, alerts, sheets, animations: document.getAnimations().length, h1: document.querySelectorAll('h1').length };
});
const overflow = (page) => page.evaluate(() => {
  const W = document.documentElement.clientWidth;
  const off = [...document.querySelectorAll('body *')].filter((el) => {
    if (el.closest('svg,.vh,.vh-input,[inert]')) return false;
    const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > W + 0.5 || r.left < -0.5);
  }).map((el) => (el.className && el.className.baseVal === undefined ? el.className : el.tagName) + ' ' + el.textContent.trim().slice(0, 16));
  return { scrollWidth: document.documentElement.scrollWidth, offscreen: off.slice(0, 8), offscreenCount: off.length };
});

const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
for (const [n, full] of pages) {
  const page = await open(m, n);
  const r = report.pages[n] = { full };
  r.fonts = await fontCheck(page);
  Object.assign(r, await audit(page));
  const o = await overflow(page);
  r.scrollWidth390 = o.scrollWidth; r.offscreen390 = o.offscreen; r.offscreenCount390 = o.offscreenCount;
  r.scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.screenshot({ path: `${out}/${n}_vp.png` });
  if (full) {
    await page.setViewportSize({ width: 390, height: Math.max(844, r.scrollHeight) });
    await page.waitForTimeout(100);
  }
  await page.screenshot({ path: `${dir}/${n}.jpg`, type: 'jpeg', quality: 88 });
  r.errors = page._errors;
  await page.close();
}
const s = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 1 });
for (const [n] of pages) {
  const p = await open(s, n); const o = await overflow(p);
  Object.assign(report.pages[n], { scrollWidth320: o.scrollWidth, offscreen320: o.offscreen, offscreenCount320: o.offscreenCount });
  await p.screenshot({ path: `${out}/${n}_320.png`, fullPage: true }); await p.close();
}
const rm = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
for (const [n] of pages) {
  const p = await open(rm, n);
  report.pages[n].reducedMotion = await p.evaluate(() => { const b = document.querySelector('.btn,.fab,.tab'); return { transition: b ? getComputedStyle(b).transitionDuration : '-', animations: document.getAnimations().length }; });
  await p.close();
}
// contact sheet: first screen (390x844) of every page, 6 columns, <= 1600px wide
{
  const COLS = 6, GAP = 16, PAD = 24, W = 1600, colW = Math.floor((W - PAD * 2 - GAP * (COLS - 1)) / COLS);
  const cells = pages.map(([n, full, id, label]) => `<figure><figcaption><b>${n}</b><span>${id} ${label}${full ? '（個別 JPEG は全長）' : ''}</span></figcaption><img src="file://${out}/${n}_vp.png"></figure>`).join('');
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&family=Noto+Sans+JP:wght@400;700&display=swap" rel="stylesheet"><style>
  body{margin:0;width:${W}px;background:#d8ccb6;font-family:Lato,"Noto Sans JP",sans-serif;color:#191919}
  h1{margin:0;padding:${PAD}px ${PAD}px 8px;font-size:22px} p.sub{margin:0;padding:0 ${PAD}px 16px;font-size:14px;color:#3a3632}
  main{display:grid;grid-template-columns:repeat(${COLS},${colW}px);gap:24px ${GAP}px;padding:0 ${PAD}px ${PAD}px}
  figure{margin:0} figcaption{display:grid;height:44px;font-size:12px;line-height:18px} figcaption b{font-size:13px} img{display:block;width:${colW}px;height:auto;box-shadow:0 1px 3px rgb(0 0 0 / .25)}
  </style></head><body><h1>管理 PWA 展開カンプ（expanded/admin）— 22 画面</h1><p class="sub">DG-001 v0.3「A ヘリテージ・ペーパー」／ WF-A v0.3 ／ 390×844 の 1 画面目。02_today_dark は data-theme="dark"</p><main>${cells}</main></body></html>`;
  writeFileSync(`${out}/contact_sheet.html`, html);
  const c = await browser.newContext({ viewport: { width: W, height: 800 }, deviceScaleFactor: 1 });
  const p = await c.newPage(); await p.goto(`file://${out}/contact_sheet.html`, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `${dir}/contact_sheet.jpg`, type: 'jpeg', quality: 88, fullPage: true });
  report.contactSheet = await p.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
  await p.close();
}
writeFileSync(`${out}/audit.json`, JSON.stringify(report, null, 1));
for (const [n, r] of Object.entries(report.pages)) {
  const small = r.targets.filter((t) => t.w < 44 || t.h < 44);
  console.log(n.padEnd(30), r.theme, 'sw', r.scrollWidth390, r.scrollWidth320, 'off', r.offscreenCount390, r.offscreenCount320, 'h', r.scrollHeight, 'targets', r.targets.length, 'min', Math.min(...r.targets.map((t) => Math.min(t.w, t.h))), 'cards', JSON.stringify(r.cards), 'fab', JSON.stringify(r.fabs), 'tab', r.tabbar ? r.tabbar.ul + '+' + r.tabbar.padBottom : '-', small.length ? 'SMALL ' + JSON.stringify(small) : '', r.unlabeled.length ? 'UNLABELED ' + r.unlabeled : '', r.errors.length ? 'ERR ' + r.errors : '');
}
console.log('contact sheet', JSON.stringify(report.contactSheet));
await browser.close();
