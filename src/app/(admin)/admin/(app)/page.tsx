import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { BarberPole } from '@/components/ui/barber-pole'
import { formatDateJa, weekdayJa, weekStart } from '@/domain/jst-format'
import { addDays, isDateString, jstDate } from '@/domain/time'
import { requireAdminPage } from '@/features/admin/auth'
import { DayView, ResubscribeBanner } from '@/features/admin/components/today-view'
import { getAdminMenus, getDayAgenda, getWeek } from '@/features/admin/queries'
import { S } from '@/features/admin/strings'

export const metadata: Metadata = { title: '予約' }

/**
 * S-A-02 予約 (start_url, FR-A-02/03; simplified 2026-10-13): a week strip (tap a day; ‹ › move
 * a week) and the chosen day's bookings as a plain list with the free time below. The week view
 * (S-A-03) is folded into the strip. `?date=YYYY-MM-DD` shows another day. Never cached.
 */
export default function DayPage({ searchParams }: PageProps<'/admin'>) {
  return (
    <div className="has-tabbar has-fab">
      <Suspense fallback={<DaySkeleton />}>
        <Day searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function Day({ searchParams }: Pick<PageProps<'/admin'>, 'searchParams'>) {
  // Request-time first: "today" must never be computed during a prerender.
  await connection()
  const sp = await searchParams
  const today = jstDate(new Date())
  const raw = typeof sp.date === 'string' ? sp.date : ''
  const date = isDateString(raw) ? raw : today
  await requireAdminPage(date === today ? '/admin' : `/admin?date=${date}`)
  const start = weekStart(date)
  const [agenda, week, menus] = await Promise.all([getDayAgenda(date), getWeek(start), getAdminMenus()])
  const linkMenus = menus
    .filter((m) => m.isActive)
    .map((m) => ({ slug: m.slug, nameJa: m.nameJa, nameEn: m.nameEn, durationMin: m.durationMin }))
  const isToday = date === today
  const href = (d: string) => (d === today ? '/admin' : `/admin?date=${d}`) as Route
  const month = Number(date.slice(5, 7))

  return (
    <>
      <header className="v2-head paper">
        <div className="v2-head-row">
          <h1>
            <span className="num">{month}</span>月
          </h1>
          {isToday ? null : (
            <Link className="v2-pill" href="/admin">
              {S.day.backToToday}
            </Link>
          )}
        </div>
        <nav className="wstrip" aria-label={S.day.weekNav}>
          <Link className="wnav" href={href(addDays(start, -7))} aria-label={S.day.prevWeek}>
            ‹
          </Link>
          <ol>
            {week.map((d) => {
              const current = d.date === date
              return (
                <li key={d.date}>
                  <Link
                    href={href(d.date)}
                    aria-current={current ? 'date' : undefined}
                    aria-label={`${formatDateJa(d.date)} ${d.isClosed ? S.day.closedShort : S.day.countAria(d.bookingCount)}`}
                    className={[current ? 'sel' : '', d.date === today ? 'today' : '', d.isClosed ? 'off' : '']
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className="dow">{weekdayJa(d.date)}</span>
                    <b className="num">{Number(d.date.slice(8))}</b>
                    <i aria-hidden="true">
                      {d.isClosed ? S.day.closedShort : d.bookingCount > 0 ? d.bookingCount : ''}
                    </i>
                  </Link>
                </li>
              )
            })}
          </ol>
          <Link className="wnav" href={href(addDays(start, 7))} aria-label={S.day.nextWeek}>
            ›
          </Link>
        </nav>
      </header>
      <ResubscribeBanner />
      <main className="wrap v2-day">
        <h2 className="v2-date">
          {formatDateJa(date)}
          {isToday ? <span className="v2-chip">{S.today.todayChip}</span> : null}
        </h2>
        <DayView agenda={agenda} menus={linkMenus} />
      </main>
    </>
  )
}

function DaySkeleton() {
  return (
    <>
      <header className="v2-head paper" aria-busy="true">
        <div className="v2-head-row">
          <h1>{S.loading}</h1>
        </div>
      </header>
      <div className="wrap v2-day">
        <BarberPole className="v2-pole" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    </>
  )
}
