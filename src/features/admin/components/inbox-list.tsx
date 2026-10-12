'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { formatDateJa } from '@/domain/jst-format'
import { jstDate } from '@/domain/time'
import { acknowledgeAllAction, unacknowledgeAction } from '../actions'
import type { InboxItem } from '../queries'
import { S } from '../strings'
import { Icon } from './icon'
import { useInbox } from './inbox-provider'
import { hhmm, nowMinutes } from './time-utils'
import { useToast } from './toast'
import { describeFailure } from './use-admin-action'

/** S-A-07 受信箱 (FR-A-10, 11): unread first, "すべて確認済みにする" with undo. */
export function InboxList({ unread, read, nowIso }: { unread: InboxItem[]; read: InboxItem[]; nowIso: string }) {
  const toast = useToast()
  const inbox = useInbox()
  const [pending, startTransition] = useTransition()
  const [now] = useState(() => new Date(nowIso).getTime())

  function ackAll() {
    if (unread.length === 0) return
    startTransition(async () => {
      const res = await acknowledgeAllAction()
      const failure = describeFailure(res)
      if (failure || res.status !== 'ok') {
        toast.show({ message: failure ?? (S.errors.generic as string) })
        return
      }
      inbox.setCount(res.data.unacknowledged)
      const ids = res.data.ids
      toast.show({
        message: S.inbox.ackedToast(ids.length),
        undo: async () => {
          const r = await unacknowledgeAction({ ids })
          if (r.status === 'ok') inbox.setCount(r.data.unacknowledged)
        },
      })
    })
  }

  const row = (item: InboxItem, isUnread: boolean) => {
    const date = jstDate(new Date(item.start))
    const when = (
      <>
        <span className="num">{formatDateJa(date).replace(/（.*$/, '')}</span>
        {formatDateJa(date).replace(/^[^（]*/, '')}
        <span className="num">{hhmm(nowMinutes(date, new Date(item.start)))}</span>
      </>
    )
    const at = new Date(item.at)
    const minutesAgo = Math.max(0, Math.floor((now - at.getTime()) / 60_000))
    const atDate = jstDate(at)
    return (
      <li key={item.id}>
        <Link className="ib-row" href={`/admin/bookings/${item.id}`}>
          <span className={`kind ${item.kind === 'cancel' ? 'cx' : ''}`}>
            {item.kind === 'cancel' ? S.inbox.kindCancel : S.inbox.kindNew}
          </span>
          <span className="ib-body">
            <span className="dtm">{item.kind === 'cancel' ? <s>{when}</s> : when}</span>
            <span className="nm">
              {item.name ?? 'お客様'}様{item.nameKana ? <span className="muted">（{item.nameKana}）</span> : null}
            </span>
            <span className="cap">
              {item.menuName}
              {item.isStudent ? S.today.student : ''} ・{' '}
              {item.kind === 'cancel' ? S.inbox.cancelledByCustomer : (S.source[item.source] ?? item.source)}
            </span>
          </span>
          <span className="ib-when">
            {isUnread ? (
              <>
                <span className="new">
                  <span aria-hidden="true">● </span>
                  {S.inbox.minutesAgo(minutesAgo)}
                </span>
                <span className="num">{hhmm(nowMinutes(atDate, at))}</span>
              </>
            ) : (
              <span className="num">{formatDateJa(atDate).replace(/（.*$/, '')}</span>
            )}
          </span>
        </Link>
      </li>
    )
  }

  return (
    <>
      <header className="ah ib-head paper">
        <h1 style={{ paddingLeft: 'var(--space-2)' }}>{S.inbox.title}</h1>
        <button
          className={`btn btn-secondary btn-sm ${unread.length === 0 ? 'is-off' : ''}`}
          type="button"
          aria-disabled={unread.length === 0 || pending}
          onClick={ackAll}
        >
          <Icon name="check" />
          {S.inbox.ackAll}
        </button>
      </header>
      <main className="wrap ib">
        {unread.length === 0 ? (
          <section className="empty" aria-labelledby="em-h">
            <span className="ill">
              <Icon name="check" />
            </span>
            <h2 id="em-h">{S.inbox.emptyTitle}</h2>
            <p>{S.inbox.emptyBody}</p>
          </section>
        ) : (
          <>
            <h2 className="sec-h first">
              {S.inbox.unreadHead}
              <span className="cap">{S.inbox.unreadCap(unread.length)}</span>
            </h2>
            <ul className="list">{unread.map((i) => row(i, true))}</ul>
          </>
        )}
        {read.length > 0 ? (
          <>
            <h2 className="sec-h">{S.inbox.readHead}</h2>
            <ul className="list read">{read.map((i) => row(i, false))}</ul>
          </>
        ) : null}
        <p className="ib-foot">
          <Icon name="refresh" />
          <span>{S.inbox.foot}</span>
        </p>
      </main>
    </>
  )
}
