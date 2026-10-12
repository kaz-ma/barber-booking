'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { formatDateJa } from '@/domain/jst-format'
import type { AgendaBlock, AgendaBooking, DayAgenda } from '../queries'
import { S } from '../strings'
import { Icon } from './icon'
import { hhmm, nowMinutes } from './time-utils'

/*
 * S-A-02 timeline (FR-A-02, DES-03 §6): 15 minutes = one row (28px), opening hours (widened for
 * out-of-hours items), booking cards ≥ 56px with a separate 44px tel: button, hatched blocks,
 * free gaps (pointer helper, aria-hidden — the FAB offers the same actions), and the now-line.
 * Items are a chronological <ol> so the reading order does not depend on the visual layout.
 */

type Props = {
  agenda: DayAgenda
  isToday: boolean
  onGap: (startMin: number) => void
  onBlock: (block: AgendaBlock) => void
}

function statusChip(b: AgendaBooking) {
  switch (b.status) {
    case 'completed':
      return (
        <span className="chip chip-muted">
          <Icon name="check" />
          {S.status.completed}
        </span>
      )
    case 'in_progress':
      return <span className="chip chip-fill">{S.status.in_progress}</span>
    case 'arrived':
      return <span className="chip">{S.status.arrived}</span>
    default:
      return <span className="chip">{S.status.confirmed}</span>
  }
}

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
  // Round inward to the 15-minute grid so the helper sits on whole rows.
  return out.map((g) => ({ s: Math.ceil(g.s / 15) * 15, e: Math.floor(g.e / 15) * 15 })).filter((g) => g.e - g.s >= 15)
}

export function Timeline({ agenda, isToday, onGap, onBlock }: Props) {
  const { startMin, endMin } = agenda.axis
  const rows = Math.max(4, Math.ceil((endMin - startMin) / 15))
  const height = `calc(${rows} * var(--row))`
  const free = useMemo(() => gaps(agenda), [agenda])
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    if (!isToday) return
    const update = () => setNow(nowMinutes(agenda.date))
    update()
    const t = setInterval(update, 60_000)
    return () => clearInterval(t)
  }, [isToday, agenda.date])

  const items = [
    ...agenda.bookings.map((b) => ({ kind: 'booking' as const, start: b.startMin, b })),
    ...agenda.blocks.map((k) => ({ kind: 'block' as const, start: k.startMin, k })),
  ].sort((a, z) => a.start - z.start)

  const labels: { min: number; hour: boolean }[] = []
  for (let m = startMin; m <= endMin; m += 30) labels.push({ min: m, hour: m % 60 === 0 })
  const nowInAxis = now !== null && now >= startMin && now <= endMin
  const dateLabel = formatDateJa(agenda.date)

  return (
    <div className="tl">
      <div className="tl-hours" aria-hidden="true" style={{ height }}>
        {nowInAxis ? (
          <span className="now-label" style={{ ['--m' as string]: now - startMin }}>
            <span className="vh">{S.today.now} </span>
            {hhmm(now)}
          </span>
        ) : null}
        {labels.map((l) => (
          <span
            key={l.min}
            className={l.hour ? 'h' : undefined}
            style={{ top: `calc(${(l.min - startMin) / 15} * var(--row))` }}
          >
            {hhmm(l.min)}
          </span>
        ))}
      </div>
      <div className="lane" style={{ height }}>
        {free.map((g) => (
          <button
            key={g.s}
            type="button"
            className="slot-pos free free-btn"
            style={{ ['--s' as string]: (g.s - startMin) / 15, ['--d' as string]: Math.max(1, (g.e - g.s) / 15) }}
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => onGap(g.s)}
          >
            <Icon name="plus" />
            <span>{S.today.free}</span>
          </button>
        ))}
        <ol className="agenda" aria-label={S.today.agendaLabel(dateLabel)}>
          {items.map((item) =>
            item.kind === 'booking' ? (
              <BookingCard key={item.b.id} b={item.b} axisStart={startMin} />
            ) : (
              <li
                key={item.k.id}
                className="slot-pos blk-wrap"
                style={{
                  ['--s' as string]: (item.k.startMin - startMin) / 15,
                  ['--d' as string]: Math.max(1, (item.k.endMin - item.k.startMin) / 15),
                }}
              >
                <button type="button" className="blk" onClick={() => onBlock(item.k)}>
                  <span className="lbl">
                    <Icon name="block" />
                    <b>{S.blockKind[item.k.kind] ?? item.k.kind}</b>
                    <span className="num">
                      {hhmm(item.k.startMin)}–{hhmm(item.k.endMin)}
                    </span>
                    {item.k.label ? <span className="muted">{item.k.label}</span> : null}
                  </span>
                  <span className="vh">{S.today.blockVh}</span>
                </button>
              </li>
            ),
          )}
        </ol>
        {nowInAxis ? <div className="now" style={{ ['--m' as string]: now - startMin }} aria-hidden="true" /> : null}
      </div>
    </div>
  )
}

function BookingCard({ b, axisStart }: { b: AgendaBooking; axisStart: number }) {
  const name = b.name ?? 'お客様'
  const rowsTall = Math.max(2, (b.endMin - b.startMin) / 15)
  return (
    <li
      className={`slot-pos bk ${b.status === 'completed' ? 'is-done' : ''}`}
      style={{ ['--s' as string]: (b.startMin - axisStart) / 15, ['--d' as string]: rowsTall }}
    >
      <Link className="bk-main" href={`/admin/bookings/${b.id}`}>
        <span className="bk-time">
          <span className="num">
            {hhmm(b.startMin)}
            <span aria-hidden="true">–</span>
            <span className="vh">{S.today.from}</span>
            {hhmm(b.endMin)}
          </span>
          {statusChip(b)}
          {b.unacknowledged ? (
            <span className="chip chip-info">
              <span aria-hidden="true">●</span>
              {S.unread}
            </span>
          ) : null}
        </span>
        <span className="bk-name">
          <b>{name}</b>
          {b.nameKana ? <span className="kana">（{b.nameKana}）</span> : null}
        </span>
        <span className="bk-meta">
          {b.menuName}
          {b.isStudent ? S.today.student : ''} <span className="pill">{S.source[b.source] ?? b.source}</span>
          {b.hasNote ? (
            <>
              <Icon name="note" />
              <span className="vh">{S.today.noteVh}</span>
            </>
          ) : null}
        </span>
      </Link>
      {b.phoneE164 ? (
        <a className="tel" href={`tel:${b.phoneE164}`} aria-label={S.today.call(name)}>
          <Icon name="phone" />
        </a>
      ) : null}
    </li>
  )
}
