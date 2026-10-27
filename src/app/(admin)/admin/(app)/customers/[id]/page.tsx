import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { formatDateJa, formatTimeOnDate } from '@/domain/jst-format'
import { jstDate } from '@/domain/time'
import { requireAdminPage } from '@/features/admin/auth'
import { CustomerActions } from '@/features/admin/components/customer-actions'
import { Icon } from '@/features/admin/components/icon'
import { InstagramField } from '@/features/admin/components/instagram-field'
import { PreviousKarte } from '@/features/admin/components/karte-panel'
import { getCustomerKarte } from '@/features/admin/karte'
import { getCustomerDetail } from '@/features/admin/queries'
import { S } from '@/features/admin/strings'

export const metadata: Metadata = { title: 'お客様の詳細' }

/** S-A-11 顧客詳細 (FR-A-13, 14; Should). */
export default function CustomerPage({ params }: PageProps<'/admin/customers/[id]'>) {
  return (
    <div className="has-tabbar">
      <Suspense fallback={<p className="wrap dt">{S.loading}</p>}>
        <Customer params={params} />
      </Suspense>
    </div>
  )
}

async function Customer({ params }: Pick<PageProps<'/admin/customers/[id]'>, 'params'>) {
  const { id } = await params
  await requireAdminPage(`/admin/customers/${id}`)
  const [c, karte] = await Promise.all([getCustomerDetail(id), getCustomerKarte(id)])
  return (
    <>
      <header className="ah paper">
        <Link className="icon-btn" href="/admin/customers" aria-label={S.back}>
          <Icon name="back" />
        </Link>
        <h1>{S.customers.title}</h1>
      </header>
      <main className="wrap dt">
        {!c ? (
          <p>{S.errors.not_found as string}</p>
        ) : (
          <>
            <section className="who">
              <h2>
                {c.name ?? '—'}
                {c.nameKana ? <span className="kana">{c.nameKana}</span> : null}
              </h2>
              {c.phoneE164 ? (
                <a className="btn btn-secondary btn-sm" href={`tel:${c.phoneE164}`}>
                  <Icon name="phone" />
                  {S.detail.call}
                </a>
              ) : null}
            </section>
            <dl className="kv card">
              <div>
                <dt>{S.customers.phone}</dt>
                <dd className="num">
                  {c.phoneE164 ?? S.detail.phoneNone}
                  {c.phoneE164 && c.phoneUnverified ? S.detail.phoneUnverified : ''}
                </dd>
              </div>
              <div>
                <dt>{S.detail.customer}</dt>
                <dd>{S.detail.customerStats(c.visitCount, c.noShowCount, c.lateCancelCount)}</dd>
              </div>
            </dl>
            {c.name ? <InstagramField customerId={c.id} handle={c.instagramHandle} /> : null}
            <h2 className="sec-h">{S.karte.history}</h2>
            {karte.length === 0 ? (
              <p className="v2-cap">{S.karte.historyNone}</p>
            ) : (
              <div className="kt-history">
                {karte.map((k) => (
                  <PreviousKarte key={k.id} entry={k} label={S.karte.visit} />
                ))}
              </div>
            )}
            <CustomerActions customerId={c.id} restriction={c.restriction} hasPhone={Boolean(c.phoneE164)} />
            <h2 className="sec-h">{S.customers.bookingsHead}</h2>
            <ul className="list">
              {c.bookings.map((b) => {
                const d = jstDate(new Date(b.start))
                return (
                  <li key={b.id}>
                    <Link className="row-link" href={`/admin/bookings/${b.id}`}>
                      <span className="grow">
                        <b>{formatDateJa(d)}</b> <span className="num">{formatTimeOnDate(new Date(b.start), d)}</span>{' '}
                        {b.menuName}
                        <span className="cap" style={{ display: 'block' }}>
                          {S.status[b.status] ?? b.status}
                        </span>
                      </span>
                      <Icon name="chev-r" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </main>
    </>
  )
}
