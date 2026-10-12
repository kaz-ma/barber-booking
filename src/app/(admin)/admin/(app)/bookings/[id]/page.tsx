import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { formatDateJa, formatTimeOnDate } from '@/domain/jst-format'
import { jstDate } from '@/domain/time'
import { requireAdminPage } from '@/features/admin/auth'
import { BookingActions } from '@/features/admin/components/booking-actions'
import { Icon } from '@/features/admin/components/icon'
import { getBookingDetail } from '@/features/admin/queries'
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
      <main className="wrap dt">
        <section className="who" aria-labelledby="nm">
          <p className="when">
            <span>{formatDateJa(date)}</span>
            <span className="t num">
              {cancelled ? (
                <s>
                  {formatTimeOnDate(start, date)}
                  <span>–</span>
                  {formatTimeOnDate(new Date(b.end), date)}
                </s>
              ) : (
                <>
                  {formatTimeOnDate(start, date)}
                  <span>–</span>
                  {formatTimeOnDate(new Date(b.end), date)}
                </>
              )}
            </span>
          </p>
          <h2 id="nm">
            {name}
            {b.customer.nameKana ? <span className="kana">{b.customer.nameKana}</span> : null}
          </h2>
          {b.customer.phoneE164 ? (
            <a className="btn btn-secondary btn-sm" href={`tel:${b.customer.phoneE164}`}>
              <Icon name="phone" />
              {S.detail.call}
            </a>
          ) : null}
        </section>

        {deleted ? (
          <p className="banner info done-banner" role="status">
            <Icon name="info" />
            <span>{S.detail.deleted}</span>
          </p>
        ) : null}

        <dl className="kv card">
          <div>
            <dt>{S.detail.menu}</dt>
            <dd>{S.detail.menuValue(b.menu.nameJa, b.durationMin, b.bufferMin)}</dd>
          </div>
          <div>
            <dt>{S.detail.price}</dt>
            <dd>
              <span className="num">¥{b.priceJpy.toLocaleString('ja-JP')}</span>
              {b.isStudent ? S.detail.studentPrice : ''}
            </dd>
          </div>
          <div>
            <dt>{S.detail.occupation}</dt>
            <dd>{b.isStudent ? S.detail.student : S.detail.worker}</dd>
          </div>
          <div>
            <dt>{S.detail.phone}</dt>
            <dd className="num">
              {phone ?? S.detail.phoneNone}
              {phone && b.customer.phoneUnverified ? S.detail.phoneUnverified : ''}
            </dd>
          </div>
          <div>
            <dt>{S.detail.note}</dt>
            <dd style={{ whiteSpace: 'pre-wrap' }}>{b.note ?? S.detail.noteNone}</dd>
          </div>
          <div>
            <dt>{S.detail.source}</dt>
            <dd>
              <span className="pill">{S.source[b.source] ?? b.source}</span> {S.sourceLong[b.source] ?? ''}
            </dd>
          </div>
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

        <section className="audit sunken" aria-labelledby="au-h">
          <h3 id="au-h">{S.detail.history}</h3>
          <ol>
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
        </section>
      </main>
    </>
  )
}
