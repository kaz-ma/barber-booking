import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { formatDateJa } from '@/domain/jst-format'
import { addDays, isDateString, jstDate } from '@/domain/time'
import { requireAdminPage } from '@/features/admin/auth'
import { Icon } from '@/features/admin/components/icon'
import { InboxButton } from '@/features/admin/components/tab-bar'
import { ResubscribeBanner, TodayView } from '@/features/admin/components/today-view'
import { getAdminSettings, getDayAgenda } from '@/features/admin/queries'
import { S } from '@/features/admin/strings'

export const metadata: Metadata = { title: '今日' }

/** S-A-02 今日 (start_url, FR-A-02). `?date=YYYY-MM-DD` shows another day. Never cached. */
export default function TodayPage({ searchParams }: PageProps<'/admin'>) {
  return (
    <div className="has-tabbar has-fab">
      <Suspense fallback={<TodaySkeleton />}>
        <Today searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

function freeLabel(min: number): { value: number; unit: string } {
  return min >= 120 && min % 60 === 0
    ? { value: min / 60, unit: S.today.summary.hours }
    : { value: min, unit: S.today.summary.minutes }
}

async function Today({ searchParams }: Pick<PageProps<'/admin'>, 'searchParams'>) {
  // Request-time first: "today" must never be computed during a prerender.
  await connection()
  const sp = await searchParams
  const today = jstDate(new Date())
  const raw = typeof sp.date === 'string' ? sp.date : ''
  const date = isDateString(raw) ? raw : today
  await requireAdminPage(date === today ? '/admin' : `/admin?date=${date}`)
  const [agenda, settings] = await Promise.all([getDayAgenda(date), getAdminSettings()])
  const isToday = date === today
  const prev = addDays(date, -1)
  const next = addDays(date, 1)
  const free = freeLabel(agenda.freeMinutes)
  const empty = agenda.bookings.length === 0

  return (
    <>
      <header className="ah dayhead paper">
        <Link className="icon-btn" href={`/admin?date=${prev}`} aria-label={S.today.prevDay(formatDateJa(prev))}>
          <Icon name="chev-l" />
        </Link>
        <h1>
          <span className="num">{formatDateJa(date).replace(/（.*$/, '')}</span>
          {formatDateJa(date).replace(/^[^（]*/, '')}
          {isToday ? <span className="chip chip-fill">{S.today.todayChip}</span> : null}
        </h1>
        <Link className="icon-btn" href={`/admin?date=${next}`} aria-label={S.today.nextDay(formatDateJa(next))}>
          <Icon name="chev-r" />
        </Link>
        <InboxButton />
      </header>
      <ResubscribeBanner />
      <p className="daysum">
        <span>
          {S.today.summary.bookings} <b>{agenda.bookings.length}</b> {S.today.summary.unitCount}
        </span>
        <span>
          {S.today.summary.blocks} <b>{agenda.blocks.length}</b>
        </span>
        <span>
          {S.today.summary.free} <b>{free.value}</b> {free.unit}
        </span>
        {agenda.cancelledCount > 0 ? <span>{S.today.cancelledCount(agenda.cancelledCount)}</span> : null}
      </p>
      {agenda.hours.isClosed ? (
        <div className="wrap res">
          <p className="banner info" role="status">
            <Icon name="info" />
            <span>{agenda.hours.isOverride ? S.today.closedOverride : S.today.closedDay}</span>
          </p>
        </div>
      ) : null}
      {empty ? (
        <div className="wrap res">
          <section
            className="card empty"
            aria-labelledby="empty-h"
            style={{ padding: 'var(--space-6) var(--space-4)' }}
          >
            <span className="empty-ic">
              <Icon name="today" />
            </span>
            <h2 id="empty-h">{isToday ? S.today.emptyTitle : S.today.emptyOtherDay}</h2>
            <p>{S.today.emptyBody}</p>
            {!isToday ? (
              <Link className="btn btn-secondary btn-sm" href="/admin">
                {S.today.backToToday}
              </Link>
            ) : null}
          </section>
        </div>
      ) : null}
      <TodayView agenda={agenda} isToday={isToday} leadTimeMin={settings.leadTimeMin} />
    </>
  )
}

function TodaySkeleton() {
  return (
    <>
      <header className="ah dayhead paper" aria-busy="true">
        <h1>{S.loading}</h1>
      </header>
      <div className="wrap" style={{ paddingTop: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}>
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    </>
  )
}
