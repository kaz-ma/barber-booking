import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { requireAdminPage } from '@/features/admin/auth'
import { Icon } from '@/features/admin/components/icon'
import { RevisitList } from '@/features/admin/components/revisit-list'
import { SettingsHeader } from '@/features/admin/components/settings-nav'
import { getRevisitList } from '@/features/admin/karte'
import { searchCustomers } from '@/features/admin/queries'
import { S } from '@/features/admin/strings'
import { REVISIT_WEEKS } from '@/features/admin/types'

export const metadata: Metadata = { title: '顧客' }

/** S-A-11 顧客一覧・検索 (FR-A-13, Should). Plain GET form: works without JavaScript. */
export default function CustomersPage({ searchParams }: PageProps<'/admin/customers'>) {
  return (
    <div className="has-tabbar">
      <SettingsHeader title={S.settings.customers} back />
      <main className="wrap set">
        <Suspense fallback={<p className="help">{S.loading}</p>}>
          <Customers searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  )
}

async function Customers({ searchParams }: Pick<PageProps<'/admin/customers'>, 'searchParams'>) {
  await requireAdminPage('/admin/customers')
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 50) : ''
  const w = Number(sp.weeks)
  const weeks = (REVISIT_WEEKS as readonly number[]).includes(w) ? w : 5
  const [items, revisit] = await Promise.all([searchCustomers(q), q ? null : getRevisitList({ weeks })])
  return (
    <>
      {revisit ? <RevisitList items={revisit} weeks={weeks} /> : null}
      <h2 className="v2-sec-h">{S.customers.searchHead}</h2>
      <form className="search-row" action="/admin/customers" method="get">
        <label className="vh" htmlFor="q">
          {S.customers.search}
        </label>
        <input
          id="q"
          name="q"
          className="input"
          type="search"
          defaultValue={q}
          placeholder={S.customers.search}
          autoComplete="off"
        />
        <button className="btn btn-secondary" type="submit">
          {S.customers.searchButton}
        </button>
      </form>
      {items.length === 0 ? (
        <p className="help mt-4">{S.customers.none}</p>
      ) : (
        <ul className="list mt-4">
          {items.map((c) => (
            <li key={c.id}>
              <Link className="cust-row" href={`/admin/customers/${c.id}`}>
                <span>
                  <b>{c.name ?? '—'}</b>
                  {c.nameKana ? <span className="muted">（{c.nameKana}）</span> : null}
                  <span className="cap">
                    {[
                      c.phoneLast4 ? `…${c.phoneLast4}` : null,
                      S.customers.visits(c.visitCount),
                      c.lastVisitAt ? S.customers.lastVisit(c.lastVisitAt.slice(0, 10)) : null,
                      c.noShowCount > 0 ? S.customers.noShow(c.noShowCount) : null,
                      c.lateCancelCount > 0 ? S.customers.late(c.lateCancelCount) : null,
                    ]
                      .filter(Boolean)
                      .join('・')}
                    {c.restriction !== 'none' ? (
                      <>
                        {' '}
                        <span className="pill">{S.customers.restriction[c.restriction]}</span>
                      </>
                    ) : null}
                  </span>
                </span>
                <Icon name="chev-r" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
