'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { authClient } from '@/lib/auth-client'
import { logoutOtherDevicesAction, sendTestPushAction, unsubscribePushAction } from '../actions'
import type { DeviceSession, DeviceSubscription } from '../queries'
import { S } from '../strings'
import { Icon } from './icon'
import { useIsClient, useStandalone } from './client-hooks'
import { deviceLabel } from './push-client'
import { usePush } from './push-provider'
import { useToast } from './toast'
import { describeFailure } from './use-admin-action'
import { hardNavigate } from './client-hooks'

/*
 * S-A-10 通知設定・端末 (FR-A-09, 12, 16; DES-03 §9; AT-13, 14, 14b, 19). One path:
 * home screen → launch → login → 通知をオンにする → テスト通知 → 届いた / 届かない (作り直し).
 * The subscription (not Notification.permission) decides the state.
 */

type TestResult = { subscriptionId: string; platform: string; httpStatus: number | null; error?: string }

const fmt = (iso: string) => `${iso.slice(5, 10).replace('-', '/').replace(/^0/, '')} ${iso.slice(11, 16)}`

export function NotificationsPanel({
  sessions,
  subscriptions,
  passkeys,
}: {
  sessions: DeviceSession[]
  subscriptions: DeviceSubscription[]
  passkeys: number
}) {
  const router = useRouter()
  const toast = useToast()
  const push = usePush()
  const [pending, startTransition] = useTransition()
  const [results, setResults] = useState<TestResult[] | null>(null)
  const [asked, setAsked] = useState<'none' | 'yes' | 'no'>('none')
  const standalone = useStandalone()
  const [busy, setBusy] = useState(false)

  const isClient = useIsClient()
  const subscribed = push.state === 'subscribed'
  const steps = [standalone, standalone, true, subscribed]
  const currentStep = steps.findIndex((d) => !d)

  async function enable() {
    setBusy(true)
    const state = await push.enable()
    setBusy(false)
    if (state === 'subscribed') router.refresh()
  }

  function test() {
    setResults(null)
    setAsked('none')
    startTransition(async () => {
      const res = await sendTestPushAction()
      const failure = describeFailure(res)
      if (failure || res.status !== 'ok') {
        toast.show({ message: failure ?? S.notif.errorSave })
        return
      }
      setResults(res.data.results)
    })
  }

  async function rebuild() {
    setBusy(true)
    const state = await push.rebuild()
    setBusy(false)
    setResults(null)
    setAsked('none')
    toast.show({ message: state === 'subscribed' ? S.notif.rebuilt : S.notif.errorSave })
    router.refresh()
  }

  function removeSub(sub: DeviceSubscription) {
    startTransition(async () => {
      const res = await unsubscribePushAction({ subscriptionId: sub.id })
      const failure = describeFailure(res)
      if (failure) {
        toast.show({ message: failure })
        return
      }
      if (sub.endpoint === push.endpoint) await push.disable()
      router.refresh()
    })
  }

  function logoutOthers() {
    if (!window.confirm(S.notif.logoutOthersConfirm)) return
    startTransition(async () => {
      const res = await logoutOtherDevicesAction()
      const failure = describeFailure(res)
      if (failure || res.status !== 'ok') {
        toast.show({ message: failure ?? S.notif.errorSave })
        return
      }
      toast.show({ message: S.notif.logoutOthersDone(res.data.revokedSessions, res.data.removedSubscriptions) })
    })
  }

  function logout() {
    if (!window.confirm(S.notif.logoutConfirm)) return
    startTransition(async () => {
      if (push.endpoint) {
        await unsubscribePushAction({ endpoint: push.endpoint })
        await push.disable()
      }
      await authClient.signOut()
      hardNavigate('/admin/login')
    })
  }

  function addPasskey() {
    startTransition(async () => {
      const res = await authClient.passkey.addPasskey({ name: deviceLabel(navigator.userAgent) })
      toast.show({ message: res?.error ? S.login.registerPasskeyFailed : S.login.registerPasskeyDone })
      if (!res?.error) router.refresh()
    })
  }

  const blocked = push.state === 'blocked'

  return (
    <>
      {blocked ? (
        <section className="card blk-card" aria-labelledby="bk-h">
          <h2 id="bk-h">
            <Icon name="belloff" />
            {S.notif.blockedTitle}
          </h2>
          <p>{S.notif.blockedBody}</p>
          <ol className="osteps">
            {S.notif.blockedSteps.map((t, i) => (
              <li key={t}>
                <span className="n" aria-hidden="true">
                  {i + 1}
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
          <figure className="ios">
            <p className="crumb" aria-hidden="true">
              {S.notif.blockedCrumb}
            </p>
            <ul aria-hidden="true">
              <li className="hl">
                <span>{S.notif.blockedRows[0]}</span>
                <span className="tg" />
              </li>
              <li>
                <span>{S.notif.blockedRows[1]}</span>
                <span className="muted">{S.notif.on}</span>
              </li>
              <li>
                <span>{S.notif.blockedRows[2]}</span>
                <span className="muted">{S.notif.on}</span>
              </li>
            </ul>
            <figcaption>{S.notif.blockedFig}</figcaption>
          </figure>
          <button className="btn btn-primary btn-block" type="button" disabled={busy} onClick={enable}>
            <Icon name="refresh" />
            {S.notif.tryAgain}
          </button>
          <p className="again">{S.notif.blockedAgain}</p>
        </section>
      ) : (
        <section className="card onb" aria-labelledby="onb-h" aria-live="polite">
          <ol className="stepper" aria-label={S.notif.stepsLabel}>
            {S.notif.steps.map((label, i) => {
              const done = steps[i]
              const cur = i === currentStep
              return (
                <li key={label} className={done ? 'done' : cur ? 'cur' : ''} aria-current={cur ? 'step' : undefined}>
                  <span className="dot">{done ? <Icon name="check" /> : i + 1}</span>
                  {label}
                  {done ? <span className="vh">{S.notif.done}</span> : null}
                </li>
              )
            })}
          </ol>
          {push.state === 'unsupported' ? (
            <>
              <h2 id="onb-h">{S.notif.unsupported}</h2>
              <p>{S.notif.fallbackBody}</p>
            </>
          ) : push.state === 'not-standalone' ? (
            <>
              <h2 id="onb-h">{S.notif.onbTitle}</h2>
              <p>{S.notif.notStandalone}</p>
              <Link className="btn btn-primary btn-block" href="/admin/install">
                {S.notif.openInstall}
              </Link>
            </>
          ) : subscribed ? (
            <>
              <h2 id="onb-h">{S.notif.onTitle}</h2>
              <p>{S.notif.onbBody}</p>
            </>
          ) : (
            <>
              <h2 id="onb-h">{S.notif.onbTitle}</h2>
              <p>{S.notif.onbBody}</p>
              <button
                className="btn btn-primary btn-block"
                type="button"
                disabled={busy || push.state === 'checking'}
                onClick={enable}
              >
                <Icon name="bell" />
                {busy ? S.notif.enabling : S.notif.enable}
              </button>
              <p className="cap c">{S.notif.enableCap}</p>
              {push.state === 'no-key' ? <p className="field-error">{S.notif.testNotConfigured}</p> : null}
            </>
          )}
          <div className="verify">
            <b>{S.notif.verifyHead}</b>
            <button
              className={`btn btn-secondary btn-block ${subscribed ? '' : 'is-off'}`}
              type="button"
              aria-disabled={!subscribed || pending}
              aria-describedby={subscribed ? undefined : 'tp-h'}
              onClick={() => subscribed && !pending && test()}
            >
              <Icon name="send" />
              {pending ? S.notif.testing : S.notif.test}
            </button>
            {!subscribed ? (
              <p className="cap" id="tp-h">
                {S.notif.testDisabledWhy}
              </p>
            ) : null}
            {results ? (
              <div className="stack" role="status">
                {results.length === 0 ? (
                  <p className="help">{S.notif.testNone}</p>
                ) : (
                  <ul className="test-results">
                    {results.map((r) => {
                      const sub = subscriptions.find((s) => s.id === r.subscriptionId)
                      const label = sub ? deviceLabel(sub.userAgent) : r.platform
                      return (
                        <li key={r.subscriptionId}>
                          <Icon name={r.httpStatus && r.httpStatus < 300 ? 'check' : 'alert'} />
                          {S.notif.testResult(
                            label,
                            r.httpStatus && r.httpStatus < 300
                              ? S.notif.testSent(r.httpStatus)
                              : S.notif.testFailed(r.error ?? String(r.httpStatus ?? '')),
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
                {asked === 'none' ? (
                  <>
                    <p className="status-line">
                      <b>{S.notif.arrivedQ}</b>
                    </p>
                    <div className="btn-row">
                      <button className="btn btn-secondary" type="button" onClick={() => setAsked('no')}>
                        {S.notif.notArrived}
                      </button>
                      <button className="btn btn-primary" type="button" onClick={() => setAsked('yes')}>
                        {S.notif.arrived}
                      </button>
                    </div>
                  </>
                ) : asked === 'yes' ? (
                  <p className="status-line">
                    <Icon name="check" /> {S.notif.arrivedOk}
                  </p>
                ) : (
                  <>
                    <p className="help">{S.notif.rebuildLead}</p>
                    <button className="btn btn-primary btn-block" type="button" disabled={busy} onClick={rebuild}>
                      <Icon name="refresh" />
                      {S.notif.rebuild}
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </section>
      )}

      <h2 className="sec-h">{S.notif.subsHead}</h2>
      <ul className="list dev">
        {!subscribed && push.state !== 'unsupported' ? (
          <li>
            <Icon name="phone-dev" />
            <span className="grow">
              <b>{isClient ? deviceLabel(navigator.userAgent) : ''}</b>{' '}
              <span className="me">{S.notif.thisDevice}</span>
              <span className="cap">{S.notif.notRegistered}</span>
            </span>
          </li>
        ) : null}
        {subscriptions.map((s) => (
          <li key={s.id}>
            <Icon name={s.platform === 'desktop' ? 'laptop' : 'phone-dev'} />
            <span className="grow">
              <b>{deviceLabel(s.userAgent)}</b>{' '}
              {s.endpoint === push.endpoint ? <span className="me">{S.notif.thisDevice}</span> : null}
              <span className="cap">
                <span className="num">{S.notif.lastSeen(fmt(s.lastSeenAt))}</span>
                {s.lastSuccessAt ? <> ・ {S.notif.lastSuccess(fmt(s.lastSuccessAt))}</> : null}
                {s.failCount > 0 ? (
                  <>
                    {' '}
                    ・ <span className="fail">{S.notif.failCount(s.failCount)}</span>
                  </>
                ) : null}
              </span>
            </span>
            <button className="btn btn-secondary btn-sm" type="button" disabled={pending} onClick={() => removeSub(s)}>
              {S.notif.remove}
            </button>
          </li>
        ))}
        {subscriptions.length === 0 && subscribed ? (
          <li>
            <span className="grow cap">{S.notif.subsNone}</span>
          </li>
        ) : null}
      </ul>

      <h2 className="sec-h">{S.notif.sessionsHead}</h2>
      <ul className="list dev">
        {sessions.map((s) => (
          <li key={s.id}>
            <Icon
              name={
                /Macintosh|Windows|Linux/.test(s.userAgent ?? '') && !/Mobile/.test(s.userAgent ?? '')
                  ? 'laptop'
                  : 'phone-dev'
              }
            />
            <span className="grow">
              <b>{deviceLabel(s.userAgent)}</b> {s.current ? <span className="me">{S.notif.thisDevice}</span> : null}
              <span className="cap">{s.current ? S.notif.lastUsedNow : S.notif.lastUsed(fmt(s.updatedAt))}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="logout">
        <button
          className="btn btn-secondary btn-block"
          type="button"
          aria-describedby="lo-h"
          disabled={pending}
          onClick={logoutOthers}
        >
          <Icon name="logout" />
          {S.notif.logoutOthers}
        </button>
        <p className="cap" id="lo-h">
          {S.notif.logoutOthersHelp}
        </p>
        <button className="btn btn-ghost" type="button" disabled={pending} onClick={logout}>
          {S.notif.logout}
        </button>
      </div>

      <h2 className="sec-h">
        {S.notif.passkeyHead}
        <span className="cap">{S.notif.passkeyCount(passkeys)}</span>
      </h2>
      <button className="btn btn-secondary btn-block" type="button" disabled={pending} onClick={addPasskey}>
        <Icon name="faceid" />
        {S.notif.passkeyAdd}
      </button>

      <h2 className="sec-h">{S.notif.otherHead}</h2>
      <div className="info-cards">
        <div className="sunken">
          <Icon name="clock" />
          <span>
            <b>{S.notif.digestTitle}</b>
            {S.notif.digestBody}
          </span>
        </div>
        <div className="sunken">
          <Icon name="refresh" />
          <span>
            <b>{S.notif.fallbackTitle}</b>
            {S.notif.fallbackBody}
          </span>
        </div>
      </div>
    </>
  )
}
