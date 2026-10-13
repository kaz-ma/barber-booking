'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { authClient } from '@/lib/auth-client'
import { logoutOtherDevicesAction, sendTestPushAction, unsubscribePushAction } from '../actions'
import { S } from '../strings'
import { hardNavigate } from './client-hooks'
import { Icon } from './icon'
import { deviceLabel } from './push-client'
import { usePush } from './push-provider'
import { useToast } from './toast'
import { describeFailure } from './use-admin-action'

/*
 * S-A-10 通知とログイン (FR-A-09, 12, 16; DES-03 §9; AT-13, 14, 14b, 19; simplified 2026-10-13).
 * Two cards: 通知 (state → one button → テスト通知, 作り直し only when a test goes wrong) and
 * ログイン (Face ID, ログアウト, lost-device logout). The subscription (not
 * Notification.permission) decides the state. Device and session lists were dropped: the
 * lost-device button revokes everything else in one step.
 */

type Tested = 'none' | 'ok' | 'failed'

export function NotificationsPanel({ passkeys }: { passkeys: number }) {
  const router = useRouter()
  const toast = useToast()
  const push = usePush()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [tested, setTested] = useState<Tested>('none')
  const subscribed = push.state === 'subscribed'

  async function enable() {
    setBusy(true)
    const state = await push.enable()
    setBusy(false)
    if (state === 'subscribed') router.refresh()
  }

  function test() {
    setTested('none')
    startTransition(async () => {
      const res = await sendTestPushAction()
      const failure = describeFailure(res)
      if (failure || res.status !== 'ok') {
        toast.show({ message: failure ?? S.notif.errorSave })
        return
      }
      const ok = res.data.results.some((r) => r.httpStatus !== null && r.httpStatus < 300)
      setTested(ok ? 'ok' : 'failed')
    })
  }

  async function rebuild() {
    setBusy(true)
    const state = await push.rebuild()
    setBusy(false)
    setTested('none')
    toast.show({ message: state === 'subscribed' ? S.notif.rebuilt : S.notif.errorSave })
    router.refresh()
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

  return (
    <>
      <section className="v2-card v2-ncard" aria-labelledby="nt-h" aria-live="polite">
        <p className={`v2-state ${subscribed ? 'on' : 'off'}`}>
          <Icon name={subscribed ? 'bell' : 'belloff'} />
          <b id="nt-h">{subscribed ? S.notif.stateOn : S.notif.stateOff}</b>
        </p>

        {push.state === 'unsupported' ? (
          <p className="v2-cap">{S.notif.unsupported}</p>
        ) : push.state === 'not-standalone' ? (
          <>
            <p className="v2-cap">{S.notif.notStandalone}</p>
            <Link className="btn btn-primary btn-block" href="/admin/install">
              {S.notif.openInstall}
            </Link>
          </>
        ) : push.state === 'blocked' ? (
          <>
            <p className="v2-cap">{S.notif.blockedBody}</p>
            <ol className="v2-steps">
              {S.notif.blockedSteps.map((t, i) => (
                <li key={t}>
                  <span className="n" aria-hidden="true">
                    {i + 1}
                  </span>
                  {t}
                </li>
              ))}
            </ol>
            <button className="btn btn-primary btn-block" type="button" disabled={busy} onClick={enable}>
              <Icon name="refresh" />
              {S.notif.tryAgain}
            </button>
          </>
        ) : subscribed ? (
          <>
            <p className="v2-cap">{S.notif.onBody}</p>
            <button className="btn btn-secondary btn-block" type="button" disabled={pending} onClick={test}>
              <Icon name="send" />
              {pending ? S.notif.testing : S.notif.test}
            </button>
            {tested === 'ok' ? (
              <div className="v2-tested" role="status">
                <p>{S.notif.testOk}</p>
                <button className="v2-link" type="button" disabled={busy} onClick={rebuild}>
                  {S.notif.notArrived}
                </button>
              </div>
            ) : tested === 'failed' ? (
              <div className="v2-tested" role="status">
                <p>{S.notif.testNg}</p>
                <button className="btn btn-primary btn-block" type="button" disabled={busy} onClick={rebuild}>
                  <Icon name="refresh" />
                  {S.notif.rebuild}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <p className="v2-cap">{S.notif.offBody}</p>
            <button
              className="btn btn-primary btn-block"
              type="button"
              disabled={busy || push.state === 'checking'}
              onClick={enable}
            >
              <Icon name="bell" />
              {busy ? S.notif.enabling : S.notif.enable}
            </button>
            <p className="v2-cap c">{S.notif.enableCap}</p>
            {push.state === 'no-key' ? <p className="field-error">{S.notif.testNotConfigured}</p> : null}
          </>
        )}
      </section>

      <h2 className="v2-sec-h">{S.notif.loginHead}</h2>
      <section className="v2-card v2-lcard">
        <button className="btn btn-secondary btn-block" type="button" disabled={pending} onClick={addPasskey}>
          <Icon name="faceid" />
          {passkeys > 0 ? S.notif.passkeyAddMore : S.notif.passkeyAdd}
        </button>
        <button className="btn btn-secondary btn-block" type="button" disabled={pending} onClick={logout}>
          <Icon name="logout" />
          {S.notif.logout}
        </button>
      </section>
      <p className="v2-lost">
        <button className="v2-link" type="button" disabled={pending} onClick={logoutOthers}>
          {S.notif.logoutOthers}
        </button>
        <span className="v2-cap">{S.notif.logoutOthersHelp}</span>
      </p>
    </>
  )
}
