'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { deleteTimeBlockAction, restoreTimeBlockAction } from '../actions'
import type { AgendaBlock, DayAgenda } from '../queries'
import { S } from '../strings'
import { Icon } from './icon'
import { usePush } from './push-provider'
import { QuickSheet } from './quick-sheet'
import { Sheet } from './sheet'
import { hhmm } from './time-utils'
import { Timeline } from './timeline'
import { useToast } from './toast'
import { describeFailure } from './use-admin-action'

/** Client part of S-A-02: timeline, FAB + QuickActionSheet, block sheet, offline state. */
export function TodayView({
  agenda,
  isToday,
  leadTimeMin,
}: {
  agenda: DayAgenda
  isToday: boolean
  leadTimeMin: number
}) {
  const toast = useToast()
  const [sheet, setSheet] = useState<{ open: boolean; anchor: number | null; at: number }>({ open: false, anchor: null, at: 0 })
  const [block, setBlock] = useState<AgendaBlock | null>(null)
  const [pending, startTransition] = useTransition()
  const online = useOnline()

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
        <div className="wrap res">
          <p className="banner info" role="status">
            <Icon name="wifioff" />
            <span>{S.offline(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }))}</span>
          </p>
        </div>
      ) : null}
      <main className="tl-wrap">
        <Timeline
          agenda={agenda}
          isToday={isToday}
          onGap={(min) => online && setSheet({ open: true, anchor: min, at: Date.now() })}
          onBlock={(b) => setBlock(b)}
        />
      </main>
      <button
        className={`fab ${toast.visible ? 'lifted' : ''} ${online ? '' : 'is-off'}`}
        type="button"
        aria-haspopup="dialog"
        aria-disabled={!online}
        onClick={() => online && setSheet({ open: true, anchor: null, at: Date.now() })}
      >
        <Icon name="plus" />
        {S.today.fab}
      </button>
      <QuickSheet
        open={sheet.open}
        onClose={() => setSheet((cur) => ({ ...cur, open: false }))}
        date={agenda.date}
        isToday={isToday}
        closeMin={agenda.hours.isClosed ? null : agenda.hours.closeMin}
        leadTimeMin={leadTimeMin}
        anchorMin={sheet.anchor}
        openedAt={sheet.at}
      />
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
    <div className="wrap res">
      <section className="banner warn" aria-labelledby="rs-h">
        <Icon name="belloff" />
        <div>
          <b id="rs-h">{S.notif.resubTitle}</b>
          {S.notif.resubBody}
          <br />
          {push.state === 'blocked' ? (
            <Link className="btn btn-secondary btn-sm" href="/admin/settings/notifications">
              {S.notif.blockedTitle}
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
              <Icon name="bell" />
              {S.notif.enable}
            </button>
          )}
        </div>
      </section>
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
