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

/** S-A-07 お知らせ (FR-A-10, 11; simplified 2026-10-13): unread first, "すべて確認済み" with undo. */
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
        {formatDateJa(date)} <span className="num">{hhmm(nowMinutes(date, new Date(item.start)))}</span>
      </>
    )
    const at = new Date(item.at)
    const minutesAgo = Math.max(0, Math.floor((now - at.getTime()) / 60_000))
    const cancel = item.kind === 'cancel'
    return (
      <li key={item.id}>
        <Link className={`v2-bk v2-ib ${isUnread ? 'unread' : ''}`} href={`/admin/bookings/${item.id}`}>
          <span className="v2-ib-top">
            <span className={`v2-kind ${cancel ? 'cx' : ''}`}>{cancel ? S.inbox.kindCancel : S.inbox.kindNew}</span>
            <span className="v2-ago">{S.inbox.minutesAgo(minutesAgo)}</span>
          </span>
          <span className="v2-who">{cancel ? <s>{when}</s> : when}</span>
          <span className="v2-sub">
            {item.name ?? S.day.noName}
            {item.name ? '様' : ''} ・ {item.menuName}
          </span>
          <Icon name="chev-r" />
        </Link>
      </li>
    )
  }

  return (
    <>
      <header className="v2-head paper">
        <div className="v2-head-row">
          <h1>{S.inbox.title}</h1>
          {unread.length > 0 ? (
            <button className="v2-pill" type="button" disabled={pending} onClick={ackAll}>
              <Icon name="check" />
              {S.inbox.ackAll}
            </button>
          ) : null}
        </div>
      </header>
      <main className="wrap v2-day">
        {unread.length === 0 ? (
          <p className="v2-empty">{S.inbox.emptyTitle}</p>
        ) : (
          <ul className="v2-list" aria-label={S.inbox.unreadHead}>
            {unread.map((i) => row(i, true))}
          </ul>
        )}
        {read.length > 0 ? (
          <>
            <h2 className="v2-sec-h">{S.inbox.readHead}</h2>
            <ul className="v2-list read">{read.map((i) => row(i, false))}</ul>
          </>
        ) : null}
        <p className="v2-cap c">{S.inbox.foot}</p>
      </main>
    </>
  )
}
