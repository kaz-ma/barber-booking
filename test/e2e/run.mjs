#!/usr/bin/env node
/**
 * Customer UI end-to-end checks (no @playwright/test dependency: uses the Playwright library
 * installed at /opt/node-tools, or $PLAYWRIGHT_MODULE).
 *
 *   node test/e2e/run.mjs [--no-build] [--port 3100] [--shots <dir>] [--keep-db]
 *   (E2E_PG_URL=postgresql://…/postgres to use another server; default: scripts/db-local.sh)
 *
 * 1. Recreates an isolated database `barber_e2e` on the local cluster (scripts/db-local.sh),
 *    applies drizzle/ migrations and seeds with --activate-menus.
 * 2. `next build` (skipped with --no-build) and `next start` against that database.
 * 3. Scenarios: JA full flow (menu → time → info → confirm → done → .ics → cancel), EN flow
 *    without furigana, keyboard-only calendar, 320px no-overflow, done page ≤ 844px at 390×844,
 *    ≥ 44px targets. Exits 1 on the first failed assertion (screenshot saved next to the shots).
 */
import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')
const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const opt = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const PORT = Number(opt('--port', '3100'))
const BASE = `http://localhost:${PORT}`
const SHOTS = resolve(opt('--shots', join(ROOT, 'test-results/e2e')))
mkdirSync(SHOTS, { recursive: true })

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/opt/node-tools/node_modules/playwright/index.mjs')
const { default: pg } = await import('pg')
const { drizzle } = await import('drizzle-orm/node-postgres')
const { migrate } = await import('drizzle-orm/node-postgres/migrator')

// ---------------------------------------------------------------- database
const run = (cmd, cmdArgs, env = {}) =>
  execFileSync(cmd, cmdArgs, { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, ...env } })
    .toString()
    .trim()

// E2E_PG_URL: any reachable Postgres admin URL (…/postgres). Default: the local cluster.
let adminUrl = process.env.E2E_PG_URL ?? ''
if (!adminUrl) {
  run('bash', ['scripts/db-local.sh', 'start'])
  adminUrl = run('bash', ['scripts/db-local.sh', 'url']).replace(/\/[^/]+$/, '/postgres')
}
const E2E_DB = 'barber_e2e'
const DATABASE_URL = adminUrl.replace(/\/postgres$/, `/${E2E_DB}`)
{
  const admin = new pg.Client({ connectionString: adminUrl })
  await admin.connect()
  await admin.query(`DROP DATABASE IF EXISTS ${E2E_DB} WITH (FORCE)`)
  await admin.query(`CREATE DATABASE ${E2E_DB}`)
  await admin.end()
  const pool = new pg.Pool({ connectionString: DATABASE_URL, options: '-c TimeZone=UTC' })
  await migrate(drizzle(pool), { migrationsFolder: join(ROOT, 'drizzle') })
  await pool.end()
  run('npx', ['tsx', 'scripts/seed.ts', '--activate-menus'], { DATABASE_URL, DATABASE_URL_UNPOOLED: DATABASE_URL })
}
// ---------------------------------------------------------------- Turnstile stub
// `next start` runs with NODE_ENV=production, where secrets are mandatory and Turnstile fails
// closed (SR-05). The browser gets a fake api.js (Playwright route, below) whose tokens are
// `e2e.<n>.<cData>`; the server verifies them against this local siteverify stub
// (TURNSTILE_VERIFY_URL), which enforces single use and echoes cData like Cloudflare (SR-03).
const usedTokens = new Set()
const siteverify = createServer((req, res) => {
  let raw = ''
  req.on('data', (c) => {
    raw += c
  })
  req.on('end', () => {
    const token = new URLSearchParams(raw).get('response') ?? ''
    const m = /^e2e\.\d+\.(.*)$/.exec(token)
    const body =
      m && !usedTokens.has(token)
        ? { success: true, hostname: 'localhost', action: 'create_booking', cdata: m[1] }
        : { success: false, 'error-codes': [m ? 'timeout-or-duplicate' : 'invalid-input-response'] }
    if (m) usedTokens.add(token)
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body))
  })
})
await new Promise((r) => siteverify.listen(0, '127.0.0.1', r))
const SITEVERIFY_URL = `http://127.0.0.1:${siteverify.address().port}/siteverify`
const FAKE_TURNSTILE_JS = `(() => {
  let n = 0
  const widgets = {}
  const issue = (o) => setTimeout(() => o.callback('e2e.' + ++n + '.' + (o.cData || '')), 30)
  window.turnstile = {
    render(el, o) { const id = 'w' + Object.keys(widgets).length; widgets[id] = o; issue(o); return id },
    reset(id) { if (widgets[id]) issue(widgets[id]) },
    remove(id) { delete widgets[id] },
  }
})()`

const secret = () => randomBytes(32).toString('base64url')
const { default: webPush } = await import('web-push')
const vapid = webPush.generateVAPIDKeys()
const appEnv = {
  DATABASE_URL,
  DATABASE_URL_UNPOOLED: DATABASE_URL,
  SITE_URL: BASE,
  // Production mode requires every secret (SR-05); throwaway values for this run only.
  BETTER_AUTH_SECRET: secret(),
  PII_HASH_SECRET: secret(),
  CRON_SECRET: secret(),
  VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  VAPID_SUBJECT: 'mailto:e2e@example.com',
  ADMIN_EMAIL: 'e2e@example.com',
  RESEND_API_KEY: 're_e2e_unused',
  RESEND_FROM: 'E2E <e2e@example.com>',
  TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  TURNSTILE_SECRET_KEY: 'e2e-secret',
  TURNSTILE_VERIFY_URL: SITEVERIFY_URL,
}

// ---------------------------------------------------------------- build + start
if (!flag('--no-build')) {
  console.info('› next build')
  execFileSync('npx', ['next', 'build'], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...appEnv } })
}
console.info(`› next start -p ${PORT}`)
const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
  cwd: ROOT,
  env: { ...process.env, ...appEnv, NODE_ENV: 'production' },
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
})
let serverLog = ''
server.stdout.on('data', (d) => {
  serverLog += d
})
server.stderr.on('data', (d) => {
  serverLog += d
})
const stopServer = () => {
  try {
    process.kill(-server.pid, 'SIGTERM')
  } catch {}
  siteverify.close()
}
process.on('exit', stopServer)
for (let i = 0; ; i++) {
  try {
    const res = await fetch(`${BASE}/ja`)
    if (res.ok) break
  } catch {}
  if (i > 120) throw new Error(`server did not start\n${serverLog}`)
  await sleep(500)
}

// ---------------------------------------------------------------- helpers
const browser = await chromium.launch()
const results = []
let currentPage = null

function assert(cond, message) {
  if (!cond) throw new Error(`Assertion failed: ${message}`)
}
async function step(name, fn) {
  const t0 = Date.now()
  try {
    await fn()
    results.push({ name, ok: true, ms: Date.now() - t0 })
    console.info(`  ✓ ${name} (${Date.now() - t0} ms)`)
  } catch (e) {
    results.push({ name, ok: false })
    console.error(`  ✗ ${name}\n    ${e.message}`)
    if (currentPage)
      await currentPage
        .screenshot({ path: join(SHOTS, `FAILED-${name.replace(/\W+/g, '_')}.png`), fullPage: true })
        .catch(() => {})
    throw e
  }
}
async function newPage(viewport = { width: 390, height: 844 }, locale = 'ja-JP') {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    locale,
    timezoneId: 'America/Los_Angeles', // JST rendering must not depend on the device zone
  })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  await ctx.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_TURNSTILE_JS }),
  )
  const page = await ctx.newPage()
  page.setDefaultTimeout(15_000)
  page.on('pageerror', (e) => console.error(`    [pageerror] ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') console.error(`    [console] ${m.text().slice(0, 400)}`)
  })
  currentPage = page
  return page
}
const shot = (page, name, fullPage = true) => page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage })
const noOverflow = async (page, width) => {
  const sw = await page.evaluate(() => document.documentElement.scrollWidth)
  assert(sw <= width, `${page.url()} scrollWidth ${sw} > ${width}`)
}
/** Every visible link / button / form control is at least 44×44 (WCAG 2.5.8 target, DG-001). */
const targets44 = async (page) => {
  const small = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('a[href], button, input, textarea, summary')) {
      if (el.closest('[aria-hidden="true"]') || el.classList.contains('skip-link')) continue
      const box = (
        el.matches('input[type=radio], input[type=checkbox]') ? el.parentElement : el
      ).getBoundingClientRect()
      const style = getComputedStyle(el)
      if (box.width === 0 || box.height === 0 || style.visibility === 'hidden') continue
      if (el.matches('input[type=hidden]')) continue
      // DG-001 §4: below 360px the calendar cells are ~42×52 (approved; ≥ 24px WCAG 2.5.8 minimum).
      const min = el.classList.contains('cd') && window.innerWidth < 360 ? 40 : 43.5
      if (Math.min(box.width, box.height) < min)
        out.push(
          `${el.tagName} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(box.width)}×${Math.round(box.height)}`,
        )
    }
    return out
  })
  assert(small.length === 0, `targets < 44px on ${page.url()}: ${small.join(', ')}`)
}
const oneH1 = async (page) => {
  const texts = await page.locator('h1:visible').allTextContents()
  assert(texts.length === 1, `${page.url()} has ${texts.length} h1: ${texts.join(' | ')}`)
}
const noTel = async (page) => {
  const n = await page.locator('a[href^="tel:"]').count()
  assert(n === 0, `${page.url()} has tel: links`)
}
const activeDate = (page) => page.evaluate(() => document.activeElement?.getAttribute('data-date') ?? null)

/** Moves to a day with a free slot if the initially selected day (today) has none. */
async function ensureOpenSlots(page) {
  for (let i = 0; i < 4; i++) {
    if ((await page.locator('a.slot').count()) > 0) return
    const next = page.getByRole('link', { name: /次に空いている日へ|Next available day|次の月を見る|See next month/ })
    if ((await next.count()) > 0) {
      await next.first().click()
    } else {
      await page.locator('a.cd.open').first().click()
    }
    await page.waitForLoadState('networkidle')
  }
  assert((await page.locator('a.slot').count()) > 0, 'no open slot found')
}

// ---------------------------------------------------------------- scenarios
let jaCancelUrl = ''
try {
  await step('JA top page: structure, SEO, JSON-LD without telephone', async () => {
    const page = await newPage()
    await page.goto(`${BASE}/ja`)
    await oneH1(page)
    assert((await page.locator('article.menu-card').count()) === 9, '9 menu cards')
    assert(
      (await page.locator('article.menu-card a, article.menu-card button').count()) === 0,
      'menu cards are not links',
    )
    const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())
    assert(ld['@type'] === 'HairSalon' && !('telephone' in ld), 'JSON-LD HairSalon without telephone')
    assert((await page.locator('link[rel="alternate"][hreflang="en"]').count()) === 1, 'hreflang en')
    assert((await page.locator('link[rel="alternate"][hreflang="x-default"]').count()) === 1, 'hreflang x-default')
    assert((await page.getByRole('link', { name: '予約する' }).count()) === 2, 'two 予約する CTAs')
    assert((await page.locator('a[href*="/book/time"]').count()) === 0, 'no direct link to /book/time (OI-25)')
    await noTel(page)
    await targets44(page)
    await shot(page, '01_top_ja')
    await page.context().close()
  })

  await step('JA full flow: menu → time → info → confirm → done → ics → cancel', async () => {
    const page = await newPage()
    await page.goto(`${BASE}/ja`)
    await page.locator('header').getByRole('link', { name: '予約する' }).click()
    await page.waitForURL(/\/ja\/book$/)
    await oneH1(page)
    assert(
      (await page.getByRole('link', { name: /空き時間を見て予約する/ }).count()) === 0,
      'no CTA before a menu is chosen',
    )
    await shot(page, '04_menu_initial_ja')
    await page.locator('label.rcard', { hasText: 'カット' }).first().click()
    await page.waitForURL(/menu=cut/)
    const cta = page.getByRole('link', { name: /空き時間を見て予約する/ })
    assert(await cta.isVisible(), 'sticky CTA after selection')
    await targets44(page)
    await shot(page, '04_menu_selected_ja', false)
    await cta.click()

    await page.waitForURL(/\/ja\/book\/time\?menu=cut/)
    await page.locator('table[role="grid"]').waitFor()
    await oneH1(page)
    assert((await page.locator('td [aria-current="date"]').count()) === 1, 'today marked with aria-current=date')
    for (const el of await page.locator('.cd.x, .cd.off, li.slot.x').all()) {
      assert((await el.locator('a, button, [tabindex]').count()) === 0, '× cells and rows are not focusable')
    }
    await shot(page, '02_time_ja')
    await ensureOpenSlots(page)
    await targets44(page)
    await noOverflow(page, 390)
    await page.locator('a.slot').first().click()

    await page.waitForURL(/\/ja\/book\/info/)
    await page.getByRole('heading', { name: 'お名前・ふりがな' }).waitFor()
    await oneH1(page)
    assert((await page.locator('#phone').count()) === 0, 'later stages hidden initially (AT-09)')
    await page.getByRole('button', { name: '次へ' }).click()
    await page.getByText('お名前を入力してください（例: 山田 太郎）').waitFor()
    assert((await page.locator('#name').getAttribute('aria-invalid')) === 'true', 'aria-invalid on name')
    assert((await page.locator('#name').getAttribute('aria-describedby'))?.includes('name-err'), 'error is described')
    await page.locator('#name').fill('山田 太郎')
    await page.locator('#nameKana').fill('ヤマダ タロウ')
    await page.locator('#nameKana').blur()
    assert((await page.locator('#nameKana').inputValue()) === 'やまだ たろう', 'katakana converted to hiragana on blur')
    await page.getByRole('button', { name: '次へ' }).click()
    await page.getByRole('heading', { name: 'ご職業' }).waitFor()
    assert(await page.getByText('山田 太郎（やまだ たろう）').isVisible(), 'name stage collapsed to a summary')
    await page.locator('label.radio', { hasText: '学生' }).click()
    await page.locator('#phone').waitFor()
    // Browser back re-opens the previous stage and keeps the values (AT-09).
    await page.goBack()
    await page.getByRole('heading', { name: 'ご職業' }).waitFor()
    assert(await page.getByLabel('学生').isChecked(), 'occupation kept after back')
    await page.goForward()
    await page.locator('#phone').waitFor()
    await page.locator('#phone').fill('0901234')
    await page.locator('#phone').blur()
    await page.getByText('電話番号を正しい形式で入力してください（例: 09012345678）').waitFor()
    await page.locator('#phone').fill('09012345678')
    await page.getByRole('button', { name: /ご要望を追加/ }).click()
    await page.locator('#note').fill('サイドは短めに')
    assert(await page.getByText('7 / 500').isVisible(), 'note counter')
    await targets44(page)
    await noOverflow(page, 390)
    await shot(page, '05_info_ja')
    await page.getByRole('button', { name: '確認へ進む' }).click()

    await page.waitForURL(/\/ja\/book\/confirm/)
    await page.getByRole('heading', { name: 'ご予約内容の確認' }).waitFor()
    await oneH1(page)
    const priceRow = page.locator('.ans', { hasText: '料金' })
    assert((await priceRow.getByRole('link').count()) === 0, 'price row has no 変更')
    assert((await page.getByRole('link', { name: 'メニューを変更' }).count()) === 1, 'menu row has 変更')
    const submit = page.getByRole('button', { name: 'この内容で予約を確定する' })
    assert((await submit.getAttribute('aria-disabled')) === 'true', 'submit aria-disabled before consent')
    await shot(page, '06_confirm_unchecked_ja')
    // aria-disabled (not disabled): still focusable and pressable, explains itself (FR-C-09)
    await submit.click({ force: true })
    await page.getByText('プライバシーポリシーとキャンセルポリシーへの同意にチェックしてください').waitFor()
    await page.locator('label.consent').click()
    assert((await submit.getAttribute('aria-disabled')) === null, 'submit enabled after consent')
    await targets44(page)
    await submit.click()

    await page.waitForURL(/\/ja\/book\/done\//)
    await page.getByRole('heading', { name: 'ご予約を承りました' }).waitFor()
    await oneH1(page)
    await page.waitForFunction(() => document.activeElement?.id === 'done-h')
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    assert(height <= 844, `JA done page height ${height} > 844`)
    await noTel(page)
    await targets44(page)
    await shot(page, '03_done_ja', false)
    // copy button feedback
    await page.getByRole('button', { name: /予約番号 コピー/ }).click()
    await page.getByText('コピーしました ✓').first().waitFor()
    // .ics
    const icsHref = await page.locator('a[download]').getAttribute('href')
    const ics = await page.request.get(`${BASE}${icsHref}`)
    assert(ics.status() === 200, `ics status ${ics.status()}`)
    assert(ics.headers()['content-type'].startsWith('text/calendar'), 'ics content type')
    const body = await ics.text()
    assert(body.includes('BEGIN:VCALENDAR') && body.includes('/ja/cancel/'), 'ics has the cancel URL')
    jaCancelUrl = await page.locator('#cancel-url').getAttribute('href')

    // cancel: dialog with initial focus on 予約を残す, Esc closes and returns focus
    await page.goto(`${BASE}${jaCancelUrl}`)
    await page.getByRole('heading', { name: 'ご予約のキャンセル' }).waitFor()
    await oneH1(page)
    const trigger = page.getByRole('button', { name: 'この予約をキャンセルする' })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'この予約を取り消しますか？' })
    await dialog.waitFor()
    assert(
      (await page.evaluate(() => document.activeElement?.textContent)) === '予約を残す',
      'initial focus on 予約を残す',
    )
    await shot(page, '07_cancel_sheet_ja', false)
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    assert(await trigger.evaluate((el) => el === document.activeElement), 'focus returns to the trigger')
    await trigger.click()
    await dialog.getByRole('button', { name: '予約を取り消す' }).click()
    await page.getByRole('heading', { name: '予約を取り消しました' }).waitFor()
    await page.getByText('店主に通知しました。ご連絡は不要です。').waitFor()
    await shot(page, '07_cancel_done_ja')
    await page.goto(`${BASE}${jaCancelUrl}`)
    await page.getByRole('heading', { name: 'この予約は見つかりません' }).waitFor()
    await shot(page, '07_cancel_invalid_ja', false)
    await page.context().close()
  })

  await step('EN flow: no furigana, JST, English only', async () => {
    const page = await newPage({ width: 390, height: 844 }, 'en-GB')
    await page.goto(`${BASE}/en/book?menu=cut-perm`)
    const cta = page.getByRole('link', { name: /See available times/ })
    await cta.click()
    await page.waitForURL(/\/en\/book\/time/)
    await page.locator('table[role="grid"]').waitFor()
    assert(await page.getByText('All times are Japan Standard Time (JST).').isVisible(), 'JST note on /en')
    await ensureOpenSlots(page)
    assert((await page.locator('a.slot').first().textContent()).match(/\d:\d\d [AP]M/), '12-hour clock')
    await page.locator('a.slot').first().click()
    await page.waitForURL(/\/en\/book\/info/)
    await page.getByRole('heading', { name: 'Your name' }).waitFor()
    assert((await page.locator('#nameKana').count()) === 0, 'no furigana field on /en')
    await page.locator('#name').fill('Emma Wilson')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.locator('label.radio', { hasText: 'Working adult' }).click()
    await page.locator('#phone').fill('+44 7700 900123')
    await page.getByRole('button', { name: 'Continue to review' }).click()
    await page.waitForURL(/\/en\/book\/confirm/)
    await page.getByRole('heading', { name: 'Review your booking' }).waitFor()
    assert((await page.locator('.ans', { hasText: 'Date & time' }).textContent()).includes('JST'), 'JST on review')
    await shot(page, '06_confirm_en')
    await page.locator('label.consent').click()
    await page.getByRole('button', { name: 'Confirm booking' }).click()
    await page.waitForURL(/\/en\/book\/done\//)
    await page.getByRole('heading', { name: 'Your booking is confirmed' }).waitFor()
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    assert(height <= 844, `EN done page height ${height} > 844`)
    // No Japanese outside elements marked lang="ja" (FR-C-13, NFR-EN-05).
    const stray = await page.evaluate(() => {
      const re = /[\u3040-\u30ff\u4e00-\u9fff]/
      const out = []
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const n = walker.currentNode
        if (!re.test(n.textContent)) continue
        if (n.parentElement.closest('[lang="ja"], script, style')) continue
        out.push(n.textContent.trim().slice(0, 40))
      }
      return out
    })
    assert(stray.length === 0, `Japanese text without lang="ja" on /en: ${stray.join(' | ')}`)
    await targets44(page)
    await shot(page, '03_done_en', false)
    await page.context().close()
  })

  await step('Keyboard-only month calendar (roving tabindex, arrows, Home/End, Enter, PageDown)', async () => {
    const page = await newPage()
    const nextMonth = await page.evaluate(() => {
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
      const d = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
    await page.goto(`${BASE}/ja/book/time?menu=cut&month=${nextMonth}`)
    await page.locator('table[role="grid"]').waitFor()
    let date = null
    for (let i = 0; i < 25 && !date; i++) {
      await page.keyboard.press('Tab')
      date = await activeDate(page)
    }
    assert(date, 'Tab reaches the calendar grid')
    const open = await page.$$eval('a.cd.open', (els) => els.map((e) => e.getAttribute('data-date')))
    assert(open[0] === date, 'the tab stop is the first ◎ day when nothing is selected')
    assert((await page.locator('a.cd.open[tabindex="0"]').count()) === 1, 'exactly one tab stop in the grid')
    await page.keyboard.press('ArrowRight')
    assert((await activeDate(page)) === open[1], 'ArrowRight → next ◎ day')
    await page.keyboard.press('ArrowLeft')
    assert((await activeDate(page)) === open[0], 'ArrowLeft → previous ◎ day')
    await page.keyboard.press('ArrowDown')
    const down = await activeDate(page)
    assert(down && down > open[0] && open.includes(down), 'ArrowDown → a ◎ day 7+ days later')
    await page.keyboard.press('End')
    assert((await activeDate(page)) === open[open.length - 1], 'End → last ◎ day')
    await page.keyboard.press('Home')
    assert((await activeDate(page)) === open[0], 'Home → first ◎ day')
    await page.keyboard.press('ArrowRight')
    const chosen = await activeDate(page)
    await page.keyboard.press('Tab')
    assert((await activeDate(page)) === null, 'Tab leaves the grid (single tab stop)')
    await page.keyboard.press('Shift+Tab')
    assert((await activeDate(page)) === chosen, 'Shift+Tab returns to the last focused day')
    await page.keyboard.press('Enter')
    await page.waitForURL(new RegExp(`date=${chosen}`))
    await page.waitForFunction(() => document.activeElement?.id === 'slots-h')
    assert(
      (await page.locator(`td[aria-selected="true"] a[data-date="${chosen}"]`).count()) === 1,
      'selected day has aria-selected',
    )
    // Space selects too
    await page.locator(`a[data-date="${chosen}"]`).focus()
    await page.keyboard.press('ArrowRight')
    const spaced = await activeDate(page)
    await page.keyboard.press(' ')
    await page.waitForURL(new RegExp(`date=${spaced}`))
    // PageDown → next month (if inside the window), focus stays in the grid
    const hasNext = (await page.locator('.month a[aria-label^="次の月"]').count()) > 0
    await page.locator(`a[data-date="${spaced}"]`).focus()
    await page.keyboard.press(hasNext ? 'PageDown' : 'PageUp')
    await page.waitForURL(/month=/)
    await page.waitForFunction(() => !!document.activeElement?.getAttribute('data-date'))
    await page.context().close()
  })

  await step('320px: no horizontal overflow, 44px targets', async () => {
    const page = await newPage({ width: 320, height: 640 })
    const paths = [
      '/ja',
      '/en',
      '/ja/book?menu=cut',
      '/ja/book/time?menu=cut',
      '/en/book/time?menu=cut',
      '/ja/privacy',
      '/ja/policy',
      '/ja/tokusho',
      '/en/policy',
      '/ja/no-such-page',
    ]
    for (const p of paths) {
      await page.goto(`${BASE}${p}`)
      await page.waitForLoadState('networkidle')
      await noOverflow(page, 320)
      await targets44(page)
      await oneH1(page)
      await noTel(page)
    }
    await shot(page, '08_notfound_ja_320', false)
    // info + confirm need a draft
    await page.goto(`${BASE}/ja/book`)
    await page.evaluate(() => {
      const start = new Date(Date.now() + 3 * 864e5)
      const d = start.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
      sessionStorage.setItem(
        'bb.bookingDraft.v1',
        JSON.stringify({
          savedAt: Date.now(),
          draft: {
            menuSlug: 'bleach-extra',
            startsAt: `${d}T23:00:00+09:00`,
            name: '山田 太郎',
            nameKana: 'やまだ たろう',
            occupation: 'student',
            phone: '09012345678',
            note: '',
          },
        }),
      )
    })
    for (const p of ['/ja/book/info?step=phone', '/ja/book/confirm', '/en/book/info?step=phone', '/en/book/confirm']) {
      await page.goto(`${BASE}${p}`)
      await page.waitForLoadState('networkidle')
      await page.locator('h1').waitFor()
      await noOverflow(page, 320)
      await targets44(page)
    }
    await shot(page, '06_confirm_en_320')
    await page.context().close()
  })

  await step(
    'Security: cancel action on a dotted path is rate limited; admin dotted paths go through the proxy',
    async () => {
      // SR-01: a Server Action can be posted to any URL; the limit lives in the service.
      const manifest = JSON.parse(readFileSync(join(ROOT, '.next/server/server-reference-manifest.json'), 'utf8'))
      const cancelId = Object.entries(manifest.node).find(
        ([, v]) => v.exportedName === 'cancelBooking' && v.filename?.endsWith('features/booking/actions.ts'),
      )?.[0]
      assert(cancelId, 'cancelBooking action id found')
      const statuses = []
      for (let i = 0; i < 11; i++) {
        const form = new FormData()
        form.set('_1_locale', 'ja')
        form.set('_1_token', 'C'.repeat(43))
        form.set('0', JSON.stringify(['$undefined', '$K1']))
        const res = await fetch(`${BASE}/ja/cancel/x.y`, {
          method: 'POST',
          body: form,
          headers: {
            'Next-Action': cancelId,
            Accept: 'text/x-component',
            Origin: BASE,
            'X-Forwarded-For': '203.0.113.211',
          },
        })
        const text = await res.text()
        statuses.push(`${res.status}:${text.match(/"status":"(\w+)"/)?.[1] ?? '?'}`)
      }
      assert(
        statuses.slice(0, 10).every((s) => s === '200:not_found'),
        `first 10 answered not_found: ${statuses.join(' ')}`,
      )
      assert(statuses[10] === '200:rate_limited', `11th is rate_limited (not an HTML 429): ${statuses[10]}`)

      // SR-10: dotted admin paths are redirected by the proxy; admin pages carry the nonce CSP.
      const dotted = await fetch(`${BASE}/admin/bookings/a.b`, { redirect: 'manual' })
      assert(dotted.status === 307, `dotted admin path redirected (${dotted.status})`)
      assert(dotted.headers.get('location')?.includes('/admin/login'), 'redirect target is the login page')
      const login = await fetch(`${BASE}/admin/login`)
      assert(/'nonce-[^']+'/.test(login.headers.get('content-security-policy') ?? ''), 'admin login has a nonce CSP')
      assert(
        (login.headers.get('content-security-policy') ?? '').includes('report-uri /api/csp-report'),
        'admin CSP reports to /api/csp-report',
      )
      // SR-11: the report endpoint accepts reports.
      const report = await fetch(`${BASE}/api/csp-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/csp-report' },
        body: JSON.stringify({
          'csp-report': { 'effective-directive': 'img-src', 'blocked-uri': 'https://x.example/a' },
        }),
      })
      assert(report.status === 204, `csp-report answers 204 (${report.status})`)
      // CR-10: an impossible date is not a server error.
      const bad = await fetch(`${BASE}/ja/book/time?menu=cut&date=2026-11-31`)
      assert(bad.status === 200, `invalid date handled (${bad.status})`)
    },
  )

  await step('Screenshots: policy pages and 404 at 390', async () => {
    const page = await newPage()
    for (const [p, name] of [
      ['/ja/privacy', '08_privacy_ja'],
      ['/ja/policy', '08_policy_ja'],
      ['/ja/tokusho', '09_tokusho_ja'],
      ['/ja/nope', '10_notfound_ja'],
      ['/en', '01_top_en'],
    ]) {
      await page.goto(`${BASE}${p}`)
      await page.waitForLoadState('networkidle')
      await shot(page, name)
    }
    await page.context().close()
  })
} catch {
  process.exitCode = 1
} finally {
  await browser.close()
  stopServer()
  if (!flag('--keep-db')) {
    const admin = new pg.Client({ connectionString: adminUrl })
    await admin.connect()
    await admin.query(`DROP DATABASE IF EXISTS ${E2E_DB} WITH (FORCE)`).catch(() => {})
    await admin.end()
  }
}
const failed = results.filter((r) => !r.ok).length
console.info(`\n${results.length - failed}/${results.length} scenarios passed. Screenshots: ${SHOTS}`)
process.exit(failed > 0 || process.exitCode ? 1 : 0)
