'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { deleteTimeBlockAction, restoreTimeBlockAction } from '../actions'
import type { AgendaBlock, AgendaBooking, DayAgenda } from '../queries'
import { S } from '../strings'
import { BookingLinkSheet, type LinkMenu } from './booking-link-sheet'
import { Icon } from './icon'
import { usePush } from './push-provider'
import { Sheet } from './sheet'
import { StorySheet } from './story-sheet'
import { hhmm } from './time-utils'
import { useToast } from './toast'
import { describeFailure } from './use-admin-action'

function gaps(agenda: DayAgenda): { s: number; e: number }[] {
  const { hours } = agenda
  if (hours.isClosed || hours.openMin === null || hours.closeMin === null) return []
  const busy = [
    ...agenda.bookings.map((b) => ({ s: b.startMin, e: b.endMin })),
    ...agenda.blocks.map((b) => ({ s: b.startMin, e: b.endMin })),
  ].sort((a, b) => a.s - b.s)
  const out: { s: number; e: number }[] = []
  let cursor = hours.openMin
  for (const b of busy) {
    if (b.s > cursor) out.push({ s: cursor, e: Math.min(b.s, hours.closeMin) })
    cursor = Math.max(cursor, b.e)
  }
  if (cursor < hours.closeMin) out.push({ s: cursor, e: hours.closeMin })
  return out.map((g) => ({ s: Math.ceil(g.s / 15) * 15, e: Math.floor(g.e / 15) * 15 })).filter((g) => g.e - g.s >= 30)
}

/**
 * Client part of S-A-02 (simplified 2026-10-13): the day's bookings and breaks as one list in
 * time order, then the free time as buttons (tap → manual booking at that time), and the "＋"
 * button with two choices: 予約を追加 / 休みを入れる. Tapping a break offers to delete it.
 */
export function DayView({ agenda, menus }: { agenda: DayAgenda; menus: LinkMenu[] }) {
  const toast = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [storyOpen, setStoryOpen] = useState(false)
  const [block, setBlock] = useState<AgendaBlock | null>(null)
  const [pending, startTransition] = useTransition()
  const online = useOnline()
  const free = gaps(agenda)
  const items = [
    ...agenda.bookings.map((b) => ({ key: `b-${b.id}`, start: b.startMin, b, k: null as AgendaBlock | null })),
    ...agenda.blocks.map((k) => ({ key: `k-${k.id}`, start: k.startMin, b: null as AgendaBooking | null, k })),
  ].sort((a, z) => a.start - z.start)

  function removeBlock(b: AgendaBlock) {
    startTransition(async () => {
      const res = await deleteTimeBlockAction({ blockId: b.id })
      const failure = describeFailure(res)
      setBlock(null)
      if (failure) {
        toast.show({ message: failure })
        return
      }
      toast.show({
        message: S.sheet.blockDeleted,
        sub: `${hhmm(b.startMin)}–${hhmm(b.endMin)}`,
        undo: async () => {
          const r = await restoreTimeBlockAction({ blockId: b.id })
          const f = describeFailure(r)
          if (f) toast.show({ message: f })
        },
      })
    })
  }

  return (
    <>
      {!online ? (
        <p className="v2-note" role="status">
          <Icon name="wifioff" />
          {S.offline(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }))}
        </p>
      ) : null}
      {agenda.hours.isClosed ? (
        <p className="v2-note">{agenda.hours.isOverride ? S.day.closedOverride : S.day.closed}</p>
      ) : null}

      {items.length === 0 ? (
        <p className="v2-empty">{S.day.empty}</p>
      ) : (
        <ol className="v2-list" aria-label={S.day.listLabel}>
          {items.map((it) =>
            it.b ? (
              <li key={it.key}>
                <Link
                  className={`v2-bk ${it.b.status === 'completed' ? 'is-done' : ''}`}
                  href={`/admin/bookings/${it.b.id}`}
                >
                  <span className="t num">
                    {hhmm(it.b.startMin)}
                    <small>〜{hhmm(it.b.endMin)}</small>
                  </span>
                  <span className="v2-who">
                    <b>
                      {it.b.name ?? S.day.noName}
                      {it.b.unacknowledged ? <i className="v2-new">{S.day.newBadge}</i> : null}
                      {it.b.status === 'in_progress' ? <i className="v2-st now">{S.day.inProgress}</i> : null}
                      {it.b.status === 'completed' ? <i className="v2-st">{S.day.done}</i> : null}
                    </b>
                    <span className="v2-sub">
                      {it.b.menuName}
                      {it.b.isStudent ? S.today.student : ''}
                      {it.b.hasNote ? <span className="v2-memo"> ・{S.day.hasNote}</span> : null}
                    </span>
                  </span>
                  <Icon name="chev-r" />
                </Link>
              </li>
            ) : it.k ? (
              <li key={it.key}>
                <button className="v2-blk" type="button" onClick={() => setBlock(it.k)}>
                  <span className="t num">
                    {hhmm(it.k.startMin)}
                    <small>〜{hhmm(it.k.endMin)}</small>
                  </span>
                  <span className="v2-who">
                    <b>{S.blockKind[it.k.kind] ?? it.k.kind}</b>
                    {it.k.label ? <span className="v2-sub">{it.k.label}</span> : null}
                  </span>
                  <Icon name="chev-r" />
                </button>
              </li>
            ) : null,
          )}
        </ol>
      )}
      {agenda.cancelledCount > 0 ? <p className="v2-cap">{S.today.cancelledCount(agenda.cancelledCount)}</p> : null}

      {free.length > 0 ? (
        <section className="v2-free" aria-labelledby="free-h">
          <h3 id="free-h">{S.day.freeHead}</h3>
          <ul>
            {free.map((g) => (
              <li key={g.s}>
                <Link href={`/admin/bookings/new?date=${agenda.date}&start=${hhmm(g.s)}`}>
                  <span className="num">
                    {hhmm(g.s)}〜{hhmm(g.e)}
                  </span>
                  <Icon name="plus" />
                </Link>
              </li>
            ))}
          </ul>
          {menus.length > 0 ? (
            <button className="v2-link v2-free-send" type="button" onClick={() => setLinkOpen(true)}>
              <Icon name="send" />
              {S.link.fromFree}
            </button>
          ) : null}
        </section>
      ) : null}

      <button
        className={`fab ${toast.visible ? 'lifted' : ''} ${online ? '' : 'is-off'}`}
        type="button"
        aria-haspopup="dialog"
        aria-disabled={!online}
        aria-label={S.day.addAria}
        onClick={() => online && setAddOpen(true)}
      >
        <Icon name="plus" />
        {S.today.fab}
      </button>
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title={S.day.addTitle}>
        <div className="v2-choices">
          <Link className="v2-choice" href={`/admin/bookings/new?date=${agenda.date}`}>
            <Icon name="userplus" />
            <span>
              <b>{S.day.addBooking}</b>
              <small>{S.day.addBookingSub}</small>
            </span>
          </Link>
          {menus.length > 0 ? (
            <button
              className="v2-choice"
              type="button"
              onClick={() => {
                setAddOpen(false)
                setLinkOpen(true)
              }}
            >
              <Icon name="send" />
              <span>
                <b>{S.link.open}</b>
                <small>{S.link.openSub}</small>
              </span>
            </button>
          ) : null}
          {menus.length > 0 ? (
            <button
              className="v2-choice"
              type="button"
              onClick={() => {
                setAddOpen(false)
                setStoryOpen(true)
              }}
            >
              <Icon name="share" />
              <span>
                <b>{S.story.open}</b>
                <small>{S.story.openSub}</small>
              </span>
            </button>
          ) : null}
          <Link className="v2-choice" href={`/admin/blocks/new?date=${agenda.date}`}>
            <Icon name="block" />
            <span>
              <b>{S.day.addBlock}</b>
              <small>{S.day.addBlockSub}</small>
            </span>
          </Link>
        </div>
      </Sheet>
      {storyOpen ? <StorySheet open onClose={() => setStoryOpen(false)} menus={menus} /> : null}
      <BookingLinkSheet open={linkOpen} onClose={() => setLinkOpen(false)} date={agenda.date} menus={menus} />
      <Sheet open={block !== null} onClose={() => setBlock(null)} title={S.sheet.blockDetailTitle}>
        {block ? (
          <div className="stack">
            <p className="status-line">
              <b>{S.blockKind[block.kind] ?? block.kind}</b>{' '}
              <span className="num">
                {hhmm(block.startMin)}–{hhmm(block.endMin)}
              </span>
              {block.label ? <span className="muted">（{block.label}）</span> : null}
            </p>
            <button
              className="btn btn-secondary btn-block"
              type="button"
              disabled={pending || !online}
              onClick={() => removeBlock(block)}
            >
              <Icon name="x" />
              {S.sheet.blockDelete}
            </button>
          </div>
        ) : null}
      </Sheet>
    </>
  )
}

/** Re-subscribe banner (S-A-02 §6.4 "push 未購読", 08_notifications_resubscribe comp). */
export function ResubscribeBanner() {
  const push = usePush()
  const [busy, setBusy] = useState(false)
  if (push.state !== 'unsubscribed' && push.state !== 'blocked') return null
  return (
    <div className="wrap">
      <p className="v2-alert" role="status">
        <Icon name="belloff" />
        <span>{S.day.pushOff}</span>
        {push.state === 'blocked' ? (
          <Link className="btn btn-secondary btn-sm" href="/admin/settings/notifications">
            {S.day.pushFix}
          </Link>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await push.enable()
              setBusy(false)
            }}
          >
            {S.day.pushOn}
          </button>
        )}
      </p>
    </div>
  )
}

function useOnline(): boolean {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}
