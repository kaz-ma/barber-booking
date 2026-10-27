'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { formatDateJa } from '@/domain/jst-format'
import { markRemindedAction } from '../actions'
import type { RevisitItem } from '../karte'
import { S } from '../strings'
import { REVISIT_WEEKS } from '../types'
import { Icon } from './icon'
import { useToast } from './toast'
import { describeFailure } from './use-admin-action'

/**
 * B6 そろそろ来店: customers past their usual interval with nothing booked. The owner copies a
 * DM (with a booking link for their last menu), opens their Instagram thread when the
 * username is known, and marks it sent so the row goes away until their next visit.
 * Nothing is sent automatically.
 */
export function RevisitList({ items, weeks }: { items: RevisitItem[]; weeks: number }) {
  const toast = useToast()
  const [pending, startTransition] = useTransition()

  function dmText(it: RevisitItem): string {
    const url = `${window.location.origin}/${it.locale}${it.menuSlug ? `?menu=${encodeURIComponent(it.menuSlug)}` : ''}#book`
    return it.locale === 'en'
      ? S.revisit.dmEn(it.weeks, url)
      : S.revisit.dmJa(it.name.split(/\s|　/)[0] ?? it.name, it.weeks, url)
  }

  async function copy(it: RevisitItem) {
    try {
      await navigator.clipboard.writeText(dmText(it))
      toast.show({ message: S.revisit.copied, placement: 'top', icon: true })
    } catch {
      toast.show({ message: S.detail.copyFailed, placement: 'top' })
    }
  }

  function sent(it: RevisitItem) {
    startTransition(async () => {
      const res = await markRemindedAction({ customerId: it.customerId })
      const failure = describeFailure(res)
      if (failure) {
        toast.show({ message: failure })
        return
      }
      toast.show({
        message: S.revisit.marked(it.name),
        undo: async () => {
          await markRemindedAction({ customerId: it.customerId, undo: true })
        },
      })
    })
  }

  return (
    <section className="rv" aria-labelledby="rv-h">
      <div className="rv-head">
        <h2 id="rv-h" className="v2-sec-h">
          {S.revisit.title}
          <span className="num"> {items.length}</span>
        </h2>
        <nav className="rv-weeks" aria-label={S.revisit.weeksLabel}>
          {REVISIT_WEEKS.map((w) => (
            <Link key={w} href={`/admin/customers?weeks=${w}`} aria-current={w === weeks ? 'true' : undefined}>
              {S.revisit.weeks(w)}
            </Link>
          ))}
        </nav>
      </div>
      <p className="v2-cap">{S.revisit.lead(weeks)}</p>
      {items.length === 0 ? (
        <p className="v2-cap rv-none">{S.revisit.none}</p>
      ) : (
        <ul className="rv-list">
          {items.map((it) => (
            <li key={it.customerId} className="v2-card">
              <Link className="rv-who" href={`/admin/customers/${it.customerId}`}>
                <b>{it.name}様</b>
                <span className="v2-cap">
                  {S.revisit.last(formatDateJa(it.lastVisit.slice(0, 10)), it.weeks)}
                  {it.menuName ? `・${it.menuName}` : ''}
                </span>
              </Link>
              <div className="rv-actions">
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => copy(it)}>
                  <Icon name="copy" />
                  {S.revisit.copy}
                </button>
                {it.instagramHandle ? (
                  <a
                    className="btn btn-secondary btn-sm"
                    href={`https://ig.me/m/${encodeURIComponent(it.instagramHandle)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="send" />
                    {S.revisit.openIg}
                  </a>
                ) : null}
                <button className="btn btn-secondary btn-sm" type="button" disabled={pending} onClick={() => sent(it)}>
                  <Icon name="check" />
                  {S.revisit.sent}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
