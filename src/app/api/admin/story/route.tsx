import { ImageResponse } from 'next/og'
import { connection, type NextRequest } from 'next/server'
import { shop } from '@/config/shop'
import { addDays, jstDate, monthOf } from '@/domain/time'
import { requireAdmin } from '@/features/admin/auth'
import { getAdminMenus } from '@/features/admin/queries'
import { getMonthSlots, type MonthSlotsDTO } from '@/features/availability/queries'
import { logger } from '@/lib/logger'
import { guardRoute } from '@/lib/unexpected-error'

/*
 * GET /api/admin/story?menu=slug (B5, 2026-10-18): this week's open times as a 1080×1920 PNG for
 * an Instagram story, in the site's paper style. Admin only; the numbers come from the same
 * availability query as the booking page (never cached).
 */

const NO_STORE = { 'Cache-Control': 'no-store' }
const PAPER = '#f4ecdd'
const INK = '#1d1a16'
const ACCENT = '#7a1712'
const MUTED = '#6b6255'
const WEEK_JA = ['日', '月', '火', '水', '木', '金', '土']
/** One line per day keeps all seven days and the footer inside the frame. */
const MAX_TIMES = 4

/** Google Fonts serves a TrueType subset when asked without a browser user agent. */
async function font(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`)
    ).text()
    const url = /src: url\((.+?)\) format\('(?:truetype|opentype)'\)/.exec(css)?.[1]
    return url ? await (await fetch(url)).arrayBuffer() : null
  } catch (err) {
    logger.warn('admin_api.story_font_failed', { family, message: err instanceof Error ? err.name : 'unknown' })
    return null
  }
}

type Row = { date: string; label: string; times: string[]; more: number; note: string | null }

export async function GET(request: NextRequest): Promise<Response> {
  return guardRoute('admin_api.story_failed', async () => {
    await connection()
    if (!(await requireAdmin())) return Response.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE })
    const menus = (await getAdminMenus()).filter((m) => m.isActive)
    const asked = request.nextUrl.searchParams.get('menu')
    const menu = menus.find((m) => m.slug === asked) ?? menus[0]
    if (!menu) return Response.json({ error: 'no_menu' }, { status: 404, headers: NO_STORE })

    const now = new Date()
    const today = jstDate(now)
    const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i))
    const months = [...new Set(dates.map((d) => monthOf(d)))]
    const data = (await Promise.all(months.map((month) => getMonthSlots({ menuSlug: menu.slug, month }, now)))).filter(
      (m): m is MonthSlotsDTO => m !== null,
    )
    const byDate = new Map(data.flatMap((m) => m.days.map((d) => [d.date, d] as const)))
    const rows: Row[] = dates.map((date) => {
      const d = byDate.get(date)
      const wd = new Date(`${date}T12:00:00+09:00`).getUTCDay()
      const label = `${Number(date.slice(5, 7))}/${Number(date.slice(8))}（${WEEK_JA[wd]}）`
      const times = (d?.slots ?? []).map((s) => s.slice(11, 16))
      const note =
        times.length > 0 ? null : d?.status === 'closed' ? '定休日' : d?.status === 'full' ? '満席' : '受付終了'
      return { date, label, times: times.slice(0, MAX_TIMES), more: Math.max(0, times.length - MAX_TIMES), note }
    })
    const range = `${rows[0]?.label ?? ''} 〜 ${rows.at(-1)?.label ?? ''}`
    const title = '今週の空き状況'
    const footer = 'ご予約はプロフィールのリンクから'
    const allText = [
      title,
      footer,
      range,
      menu.nameJa,
      shop.stylist.ja,
      ...rows.flatMap((r) => [r.label, r.note ?? '', ...r.times]),
      '他枠満席受付終了定休日分〜（）',
    ].join('')
    const [jp, jpBold, latin] = await Promise.all([
      font('Noto+Sans+JP', 400, allText),
      font('Noto+Sans+JP', 700, allText),
      font('Lato', 700, `NEUER BARBER AVAILABILITY @${shop.instagram.handle} 0123456789:/+`),
    ])
    const fonts = [
      jp && { name: 'Noto', data: jp, weight: 400 as const, style: 'normal' as const },
      jpBold && { name: 'Noto', data: jpBold, weight: 700 as const, style: 'normal' as const },
      latin && { name: 'Lato', data: latin, weight: 700 as const, style: 'normal' as const },
    ].filter((f): f is NonNullable<typeof f> => Boolean(f))

    return new ImageResponse(
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: PAPER,
          color: INK,
          fontFamily: 'Noto',
          padding: 72,
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            border: `3px solid ${INK}`,
            padding: '72px 64px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontFamily: 'Lato', fontSize: 40, letterSpacing: 12, fontWeight: 700 }}>NEUER BARBER</div>
            <div style={{ fontSize: 30, color: MUTED, marginTop: 8 }}>{shop.stylist.ja}</div>
            <div style={{ width: 120, height: 4, background: ACCENT, marginTop: 40 }} />
            <div style={{ fontFamily: 'Lato', fontSize: 28, letterSpacing: 8, color: ACCENT, marginTop: 40 }}>
              AVAILABILITY
            </div>
            <div style={{ fontSize: 76, fontWeight: 700, marginTop: 12 }}>{title}</div>
            <div style={{ fontSize: 34, color: MUTED, marginTop: 16 }}>
              {`${range} ・ ${menu.nameJa}（${menu.durationMin}分）`}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 64, gap: 26 }}>
            {rows.map((r) => (
              <div
                key={r.date}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderTop: `2px solid ${INK}22`,
                  paddingTop: 26,
                }}
              >
                <div style={{ width: 230, fontSize: 38, fontWeight: 700 }}>{r.label}</div>
                {r.note ? (
                  <div style={{ fontSize: 34, color: MUTED }}>{r.note}</div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                    {r.times.map((t) => (
                      <div
                        key={t}
                        style={{
                          fontFamily: 'Lato',
                          fontSize: 32,
                          fontWeight: 700,
                          padding: '6px 12px',
                          border: `2px solid ${ACCENT}`,
                          color: ACCENT,
                          borderRadius: 8,
                        }}
                      >
                        {t}
                      </div>
                    ))}
                    {r.more > 0 ? (
                      <div style={{ fontSize: 28, color: MUTED, paddingLeft: 2, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {`他${r.more}枠`}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 38, fontWeight: 700 }}>{footer}</div>
            <div style={{ fontFamily: 'Lato', fontSize: 32, color: MUTED }}>{`@${shop.instagram.handle}`}</div>
          </div>
        </div>
      </div>,
      { width: 1080, height: 1920, fonts, headers: NO_STORE },
    )
  })
}
