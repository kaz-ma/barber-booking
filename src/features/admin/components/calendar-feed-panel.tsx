'use client'

import { useState, useTransition } from 'react'
import { issueCalendarFeedAction, revokeCalendarFeedAction } from '../actions'
import { S } from '../strings'
import { Icon } from './icon'
import { useToast } from './toast'
import { describeFailure } from './use-admin-action'

/**
 * B8: subscribe the iPhone Calendar app to the bookings. The URL is shown right after it is
 * made (only its hash is stored), so making it again replaces the old one.
 */
export function CalendarFeedPanel({ on }: { on: boolean }) {
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [urls, setUrls] = useState<{ webcalUrl: string; httpsUrl: string } | null>(null)
  const [active, setActive] = useState(on)

  function issue() {
    if (active && !window.confirm(S.cal.reissueConfirm)) return
    startTransition(async () => {
      const res = await issueCalendarFeedAction()
      const failure = describeFailure(res)
      if (failure || res.status !== 'ok') {
        toast.show({ message: failure ?? (S.errors.generic as string) })
        return
      }
      setUrls(res.data)
      setActive(true)
    })
  }

  function stop() {
    if (!window.confirm(S.cal.stopConfirm)) return
    startTransition(async () => {
      const res = await revokeCalendarFeedAction()
      const failure = describeFailure(res)
      if (failure) {
        toast.show({ message: failure })
        return
      }
      setUrls(null)
      setActive(false)
      toast.show({ message: S.cal.stopped })
    })
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.show({ message: S.cal.copied, placement: 'bottom', icon: true })
    } catch {
      toast.show({ message: S.detail.copyFailed, placement: 'bottom' })
    }
  }

  return (
    <section className="v2-card cal-card">
      <p className={`v2-state ${active ? 'on' : 'off'}`}>
        <Icon name="week" />
        <b>{active ? S.cal.on : S.cal.off}</b>
      </p>
      <p className="v2-cap">{S.cal.lead}</p>
      {urls ? (
        <>
          <a className="btn btn-primary btn-block" href={urls.webcalUrl}>
            <Icon name="week" />
            {S.cal.subscribe}
          </a>
          <p className="v2-cap">{S.cal.subscribeHelp}</p>
          <button className="btn btn-ghost" type="button" onClick={() => copy(urls.httpsUrl)}>
            {S.cal.copyUrl}
          </button>
        </>
      ) : (
        <button className="btn btn-primary btn-block" type="button" disabled={pending} onClick={issue}>
          <Icon name="week" />
          {active ? S.cal.reissue : S.cal.start}
        </button>
      )}
      {active ? (
        <button className="v2-link" type="button" disabled={pending} onClick={stop}>
          {S.cal.stop}
        </button>
      ) : null}
      <p className="v2-cap">{S.cal.privacy}</p>
    </section>
  )
}
