import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { formatDateJa, weekStart } from '@/domain/jst-format'
import { addDays, isDateString, jstDate } from '@/domain/time'
import { requireAdminPage } from '@/features/admin/auth'
import { Icon } from '@/features/admin/components/icon'
import { InboxButton } from '@/features/admin/components/tab-bar'
import { getWeek } from '@/features/admin/queries'
import { S } from '@/features/admin/strings'

export const metadata: Metadata = { title: '週' }

/** S-A-03 週 (FR-A-03): 7 days with booking count and free time; tap a day -> day view. */
export default function WeekPage({ searchParams }: PageProps<'/admin/week'>) {
  return (
    <div className="has-tabbar">
      <Suspense fallback={<p className="wrap week">{S.loading}</p>}>
        <Week searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function Week({ searchParams }: Pick<PageProps<'/admin/week'>, 'searchParams'>) {
  await requireAdminPage('/admin/week')
  const sp = await searchParams
  const today = jstDate(new Date())
  const anchor = typeof sp.start === 'string' && isDateString(sp.start) ? sp.start : today
  const start = weekStart(anchor)
  const days = await getWeek(start)
  const total = days.reduce((n, d) => n + d.bookingCount, 0)

  return (
    <>
      <header className="ah paper">
        <h1 style={{ paddingLeft: 'var(--space-2)' }}>
          {S.week.title} <span className="num">{formatDateJa(start)}</span>〜
        </h1>
        <InboxButton />
      </header>
      <main className="wrap week">
        <div className="wk-nav">
          <Link className="btn btn-secondary btn-sm" href={`/admin/week?start=${addDays(start, -7)}`}>
            <Icon name="chev-l" />
            {S.week.prev}
          </Link>
          {start !== weekStart(today) ? (
            <Link className="btn btn-ghost" href="/admin/week">
              {S.week.thisWeek}
            </Link>
          ) : (
            <span className="cap">{S.week.total(total)}</span>
          )}
          <Link className="btn btn-secondary btn-sm" href={`/admin/week?start=${addDays(start, 7)}`}>
            {S.week.next}
            <Icon name="chev-r" />
          </Link>
        </div>
        <ul className="list">
          {days.map((d) => (
            <li key={d.date}>
              <Link
                className={`wk-day ${d.date === today ? 'is-today' : ''} ${d.isClosed ? 'is-closed' : ''}`}
                href={`/admin?date=${d.date}`}
                aria-label={S.week.open(formatDateJa(d.date))}
              >
                <span className="d">
                  {formatDateJa(d.date).replace(/（.*$/, '')}
                  <small>{formatDateJa(d.date).replace(/^[^（]*/, '')}</small>
                </span>
                <span className="m">
                  {d.isClosed && d.bookingCount === 0 ? (
                    <span className="chip chip-muted">{S.week.closed}</span>
                  ) : (
                    <>
                      <span>
                        <b className="num">{S.week.bookings(d.bookingCount)}</b>
                      </span>
                      {!d.isClosed ? <span className="muted">{S.week.free(d.freeMinutes)}</span> : null}
                      {d.blockCount > 0 ? <span className="pill">{S.week.blocks(d.blockCount)}</span> : null}
                      {d.unacknowledged > 0 ? (
                        <span className="chip chip-info">
                          <span aria-hidden="true">●</span>
                          {S.unread} {d.unacknowledged}
                        </span>
                      ) : null}
                    </>
                  )}
                </span>
                <Icon name="chev-r" />
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  )
}
