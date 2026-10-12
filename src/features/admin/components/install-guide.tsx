'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { S } from '../strings'
import { markBrowseOnly } from './admin-boot'
import { Icon } from './icon'
import { usePlatform } from './client-hooks'
import { isStandalone } from './push-client'

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

/*
 * S-A-12 install guidance (FR-A-09, FR-A-15, AT-11): shown in a browser tab; no notification
 * button here. iOS gets the 3-step Share → Add to Home Screen → open-from-icon guide; Android
 * Chrome keeps `beforeinstallprompt` and offers one install button (prompt() once).
 */
export function InstallGuide() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const platform = usePlatform()

  useEffect(() => {
    if (isStandalone()) window.location.replace(new URL('/admin', window.location.origin))
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  return (
    <main className="wrap ins">
      <p className="caps" lang="en">
        {S.install.caps}
      </p>
      <h1>{S.install.title}</h1>
      <p>{S.install.lead}</p>
      {platform === 'android' || deferred ? (
        <div className="stack">
          <p className="help">{S.install.androidLead}</p>
          {installed ? (
            <p className="banner info" role="status">
              <Icon name="check" />
              <span>{S.install.installed}</span>
            </p>
          ) : (
            <button
              className={`btn btn-primary btn-block ${deferred ? '' : 'is-off'}`}
              type="button"
              aria-disabled={!deferred}
              onClick={async () => {
                if (!deferred) return
                await deferred.prompt()
                await deferred.userChoice.catch(() => null)
                setDeferred(null)
              }}
            >
              <Icon name="addsq" />
              {S.install.androidInstall}
            </button>
          )}
        </div>
      ) : null}
      <ol className="steps">
        <li className="step">
          <span className="no">1</span>
          <span>
            <b>{S.install.step1}</b>
            <span className="cap">{S.install.step1Cap}</span>
          </span>
          <span className="fig" aria-hidden="true">
            <span className="dots">
              <span>…</span>
              <Icon name="share" />
            </span>
          </span>
        </li>
        <li className="step">
          <span className="no">2</span>
          <span>
            <b>{S.install.step2}</b>
            <span className="cap">{S.install.step2Cap}</span>
          </span>
          <span className="fig" aria-hidden="true">
            <span className="row">
              {S.install.step2Fig}
              <Icon name="addsq" />
            </span>
          </span>
        </li>
        <li className="step">
          <span className="no">3</span>
          <span>
            <b>{S.install.step3}</b>
            <span className="cap">{S.install.step3Cap}</span>
          </span>
          <span className="fig" aria-hidden="true">
            <span className="app">
              <i>
                <Image src="/icons/icon-192.png" alt="" width={30} height={30} unoptimized />
              </i>
              {S.appName}
            </span>
          </span>
        </li>
      </ol>
      <p className="note">
        <Icon name="info" />
        <span>{S.install.note}</span>
      </p>
      <Link className="btn btn-ghost" href="/admin/login" onClick={() => markBrowseOnly()}>
        {S.install.browseOnly}
      </Link>
    </main>
  )
}
