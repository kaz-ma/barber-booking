'use client'

import Script from 'next/script'
import { useCallback, useEffect, useRef } from 'react'
import { TURNSTILE_ACTION } from '@/lib/turnstile-action'

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id?: string) => void
  remove: (id?: string) => void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

/**
 * Cloudflare Turnstile, managed mode, explicit render (08_security.md §7). Non-interactive in
 * the normal case (WCAG 3.3.8). `cData` binds the token to the submission nonce: siteverify
 * returns it and the server requires it to match the posted nonce (SR-03). Tokens are single
 * use, so `resetOn` changes to a new non-null value after any failed submit to issue a fresh
 * token. TODO(turnstile slice): verify against real keys.
 */
export function TurnstileWidget({
  siteKey,
  locale,
  cData,
  onToken,
  resetOn,
}: {
  siteKey: string
  locale: string
  /** Submission nonce (UUID); the widget is rendered once it is known. */
  cData: string
  onToken: (token: string) => void
  resetOn?: unknown
}) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)

  const render = useCallback(() => {
    if (!ref.current || !window.turnstile || widgetId.current || !cData) return
    widgetId.current = window.turnstile.render(ref.current, {
      sitekey: siteKey,
      action: TURNSTILE_ACTION,
      cData,
      appearance: 'interaction-only',
      language: locale,
      callback: (token: string) => onToken(token),
      'expired-callback': () => {
        onToken('')
        window.turnstile?.reset(widgetId.current ?? undefined)
      },
    })
  }, [siteKey, locale, cData, onToken])

  useEffect(() => {
    render()
    return () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current)
      widgetId.current = null
    }
  }, [render])

  useEffect(() => {
    if (!resetOn || !widgetId.current) return
    onToken('')
    window.turnstile?.reset(widgetId.current)
  }, [resetOn, onToken])

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={render}
      />
      <div ref={ref} className="turnstile-slot" />
    </>
  )
}
