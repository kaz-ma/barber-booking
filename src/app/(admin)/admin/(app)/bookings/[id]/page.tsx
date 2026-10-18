import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { formatDateJa, formatTimeOnDate } from '@/domain/jst-format'
import { jstDate } from '@/domain/time'
import { requireAdminPage } from '@/features/admin/auth'
import { BookingActions } from '@/features/admin/components/booking-actions'
import { Icon } from '@/features/admin/components/icon'
import { getBookingDetail } from '@/features/admin/queries'
import { settleBookingStatuses } from '@/features/admin/service'
import { S } from '@/features/admin/strings'

export const metadata: Metadata = { title: '予約詳細' }

/** S-A-04 予約詳細 (FR-A-04, 05). Never cached; opening it acknowledges the booking. */
export default function BookingDetailPage({ params }: PageProps<'/admin/bookings/[id]'>) {
  return (
    <Suspense fallback={<p className="wrap dt">{S.loading}</p>}>
      <Detail params={params} />
    </Suspense>
  )
}

function statusChipClass(status: string): string {
  if (status === 'in_progress') return 'chip chip-fill'
  if (status === 'completed') return 'chip chip-muted'
  if (status.startsWith('cancelled') || status === 'no_show') return 'chip chip-cancel'
  return 'chip'
}

function historyText(action: string, diff: Record<string, unknown>): string {
  const base = S.audit[action] ?? action
  const to = typeof diff.to === 'string' ? S.status[diff.to] : undefined
  return to ? `${base}（${to}）` : base
}

async function Detail({ params }: Pick<PageProps<'/admin/bookings/[id]'>, 'params'>) {
  const { id } = await params
  await requireAdminPage(`/admin/bookings/${id}`)
  await settleBookingStatuses()
  const b = await getBookingDetail(id)
  if (!b) {
    return (
      <>
        <header className="ah paper">
          <Link className="icon-btn" href="/admin" aria-label={S.detail.backToday}>
            <Icon name="back" />
          </Link>
          <h1>{S.detail.title}</h1>
        </header>
        <main className="wrap dt">
          <p>{S.detail.notFound}</p>
        </main>
      </>
    )
  }
  const start = new Date(b.start)
  const date = jstDate(start)
  const name = b.customer.name ?? 'お客様'
  const cancelled = b.status.startsWith('cancelled') || b.status === 'no_show'
  const deleted = b.deleted
  const phone = b.customer.phoneDisplay ?? b.customer.phoneE164

  return (
    <>
      <header className="ah paper">
        <Link className="icon-btn" href={`/admin?date=${date}`} aria-label={S.detail.backToday}>
          <Icon name="back" />
        </Link>
        <h1>{S.detail.title}</h1>
        <span className={`${statusChipClass(b.status)} end`}>{S.status[b.status] ?? b.status}</span>
      </header>
      <main className="wrap v2-detail">
        {deleted ? <p className="v2-note">{S.detail.deleted}</p> : null}
        <section className="v2-card" aria-labelledby="nm">
          <p className="v2-when">
            <span>{formatDateJa(date)}</span>
            <b className="num">
              {cancelled ? (
                <s>
                  {formatTimeOnDate(start, date)}–{formatTimeOnDate(new Date(b.end), date)}
                </s>
              ) : (
                <>
                  {formatTimeOnDate(start, date)}–{formatTimeOnDate(new Date(b.end), date)}
                </>
              )}
            </b>
          </p>
          <h2 id="nm" className="v2-name">
            {name}
            {b.customer.nameKana ? <span className="kana">{b.customer.nameKana}</span> : null}
          </h2>
          <ul className="v2-facts">
            <li>
              {b.menu.nameJa}（{b.durationMin}分）
              {b.isStudent ? <span className="pill">{S.detail.student}</span> : null}
              {b.priceJpy > 0 ? <span className="num"> ¥{b.priceJpy.toLocaleString('ja-JP')}</span> : null}
            </li>
            <li className="muted">
              {S.detail.source}: {S.source[b.source] ?? b.source}
            </li>
          </ul>
          {b.note ? <p className="v2-memo">{b.note}</p> : null}
          {b.customer.phoneE164 ? (
            <a className="btn btn-secondary btn-block" href={`tel:${b.customer.phoneE164}`}>
              <Icon name="phone" />
              <span className="num">{phone}</span>
              {b.customer.phoneUnverified ? <small>{S.detail.phoneUnverified}</small> : null}
            </a>
          ) : null}
        </section>

        <BookingActions
          bookingId={b.id}
          status={b.status}
          source={b.source}
          locale={b.locale}
          startIso={b.start}
          unacknowledged={b.acknowledgedAt === null}
          ownerNote={b.ownerNote}
          deleted={deleted}
        />

        <details className="v2-more">
          <summary>{S.detail.more}</summary>
          <dl className="kv">
            <div>
              <dt>{S.detail.publicCode}</dt>
              <dd className="num">{b.publicCode}</dd>
            </div>
            <div>
              <dt>{S.detail.createdAt}</dt>
              <dd>
                {formatDateJa(jstDate(new Date(b.createdAt)))}{' '}
                <span className="num">{formatTimeOnDate(new Date(b.createdAt), jstDate(new Date(b.createdAt)))}</span>
              </dd>
            </div>
            <div>
              <dt>{S.detail.consent}</dt>
              <dd>
                {b.consentVersions.length > 0
                  ? b.consentVersions.map((c) => `${S.detail.consentKinds[c.kind] ?? c.kind} ${c.version}`).join(' ／ ')
                  : S.detail.consentNone}
              </dd>
            </div>
            <div>
              <dt>{S.detail.customer}</dt>
              <dd>
                <Link className="kv-link" href={`/admin/customers/${b.customer.id}`}>
                  <span>
                    {S.detail.customerStats(b.customer.visitCount, b.customer.noShowCount, b.customer.lateCancelCount)}
                  </span>
                  <Icon name="chev-r" />
                </Link>
              </dd>
            </div>
          </dl>
          <h3 className="v2-sub-h">{S.detail.history}</h3>
          <ol className="v2-hist">
            {b.history.map((h) => {
              const d = jstDate(new Date(h.at))
              return (
                <li key={`${h.at}-${h.action}`}>
                  <span className="num">
                    {d.slice(5).replace('-', '/').replace(/^0/, '')} {formatTimeOnDate(new Date(h.at), d)}
                  </span>
                  <span>{historyText(h.action, h.diff)}</span>
                </li>
              )
            })}
          </ol>
        </details>
      </main>
    </>
  )
}
