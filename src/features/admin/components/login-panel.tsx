'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, useTransition } from 'react'
import { authClient } from '@/lib/auth-client'
import { requestAdminOtpAction, verifyAdminOtpAction } from '../actions'
import { S } from '../strings'
import { hardNavigate } from './client-hooks'
import { Icon } from './icon'

/*
 * S-A-01 login (FR-A-01, ADR-0006, DES-03 §9.4). Primary: passkey (Face ID). Fallback: a
 * 6-digit code typed inside the app (one field, inputmode=numeric, autocomplete=one-time-code)
 * so the session lands in the home-screen app, never in Safari (no magic links).
 */

type Mode = 'passkey' | 'otp-intro' | 'otp-code' | 'register'

const RESEND_SEC = 60

export function LoginPanel({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>('passkey')
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [sentAt, setSentAt] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const [redirectTo, setRedirectTo] = useState(next)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!sentAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [sentAt])

  function passkey() {
    setError(null)
    startTransition(async () => {
      const res = await authClient.signIn.passkey()
      if (res?.error) {
        setError(S.login.passkeyFailed)
        return
      }
      hardNavigate(next)
    })
  }

  function sendCode() {
    setError(null)
    startTransition(async () => {
      const res = await requestAdminOtpAction()
      if (res.status === 'rate_limited') {
        setError(S.login.rateLimited(res.retryAfterSec))
        return
      }
      setSentAt(Date.now())
      setNow(Date.now())
      setMode('otp-code')
      setTimeout(() => inputRef.current?.focus(), 50)
    })
  }

  function verify(value: string) {
    setError(null)
    startTransition(async () => {
      const res = await verifyAdminOtpAction({ code: value, next })
      if (res.status === 'ok') {
        setRedirectTo(res.data.redirectTo)
        setMode('register')
        return
      }
      setError(res.status === 'rate_limited' ? S.login.rateLimited(res.retryAfterSec) : S.login.otpInvalid)
      setCode('')
      inputRef.current?.focus()
    })
  }

  function registerPasskey() {
    setError(null)
    startTransition(async () => {
      const res = await authClient.passkey.addPasskey({
        name: navigator.userAgent.includes('iPhone') ? 'iPhone' : '予約管理',
      })
      if (res?.error) {
        setError(S.login.registerPasskeyFailed)
        return
      }
      hardNavigate(redirectTo)
    })
  }

  if (mode === 'register') {
    return (
      <main className="wrap login-main">
        <div className="brand">
          <span className="appicon">
            <Image src="/icons/icon-192.png" alt="" width={76} height={76} unoptimized priority />
          </span>
          <h1>{S.login.registerPasskeyTitle}</h1>
          <p className="muted">{S.login.registerPasskeyBody}</p>
        </div>
        <div className="login-actions">
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="btn btn-primary btn-block" type="button" onClick={registerPasskey} disabled={pending}>
            <Icon name="faceid" />
            {S.login.registerPasskey}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => hardNavigate(redirectTo)}>
            {S.login.later}
          </button>
        </div>
      </main>
    )
  }

  if (mode === 'otp-intro' || mode === 'otp-code') {
    const expiresAt = sentAt ? new Date(sentAt + 10 * 60_000) : null
    const resendLeft = sentAt ? Math.max(0, RESEND_SEC - Math.floor((now - sentAt) / 1000)) : 0
    return (
      <>
        <header className="ah paper">
          <button className="icon-btn" type="button" aria-label={S.login.otpBack} onClick={() => setMode('passkey')}>
            <Icon name="back" />
          </button>
          <h1>{S.login.otpTitle}</h1>
        </header>
        <main className="wrap otp-main">
          {mode === 'otp-intro' ? (
            <>
              <p className="help">{S.login.otpIntro}</p>
              {error ? (
                <p className="field-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button className="btn btn-primary btn-block" type="button" onClick={sendCode} disabled={pending}>
                <Icon name="mail" />
                {S.login.otpSend}
              </button>
            </>
          ) : (
            <>
              <div className="banner info" role="status">
                <Icon name="mail" />
                <div>
                  <b>{S.login.otpSentTitle}</b>
                  {S.login.otpSentBody}
                </div>
              </div>
              <div className="field">
                <label className="label" htmlFor="otp">
                  {S.login.otpLabel}
                </label>
                <input
                  ref={inputRef}
                  id="otp"
                  className="input otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  aria-describedby="otp-help"
                  aria-invalid={error ? true : undefined}
                  disabled={pending}
                  onChange={(e) => {
                    const v = e.target.value.normalize('NFKC').replace(/\D/g, '').slice(0, 6)
                    setCode(v)
                    if (v.length === 6) verify(v)
                  }}
                />
                <p className="help" id="otp-help">
                  {S.login.otpHelp}
                </p>
                {error ? (
                  <p className="field-error" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
              {expiresAt ? (
                <p className="expire">
                  <Icon name="clock" />
                  {S.login.otpExpire(
                    expiresAt.toLocaleTimeString('ja-JP', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Asia/Tokyo',
                    }),
                  )}
                </p>
              ) : null}
              <button
                className={`btn btn-secondary btn-sm ${resendLeft > 0 ? 'is-off' : ''}`}
                type="button"
                aria-disabled={resendLeft > 0 || pending}
                onClick={() => {
                  if (resendLeft === 0 && !pending) sendCode()
                }}
              >
                <Icon name="refresh" />
                {resendLeft > 0 ? S.login.otpResendIn(resendLeft) : S.login.otpResend}
              </button>
            </>
          )}
        </main>
      </>
    )
  }

  return (
    <main className="wrap login-main">
      <div className="brand">
        <span className="appicon">
          <Image src="/icons/icon-192.png" alt="" width={76} height={76} unoptimized priority />
        </span>
        <h1>{S.login.title}</h1>
        <p className="wm">
          <span lang="en">{S.brand}</span>
          {S.ownerName}
        </p>
        <p className="muted">{S.login.lead}</p>
      </div>
      <div className="login-actions">
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="btn btn-primary btn-block"
          type="button"
          onClick={passkey}
          disabled={pending}
          aria-busy={pending}
        >
          <Icon name="faceid" />
          {pending ? S.login.passkeyBusy : S.login.passkey}
        </button>
        <p className="help center" style={{ whiteSpace: 'pre-line' }}>
          {S.login.passkeyHelp}
        </p>
        <div className="alt">
          <p className="help">{S.login.altLead}</p>
          <button className="btn btn-ghost" type="button" onClick={() => setMode('otp-intro')}>
            <Icon name="mail" />
            {S.login.otpLink}
          </button>
        </div>
        <p className="cap center">{S.login.keep(30)}</p>
      </div>
    </main>
  )
}
