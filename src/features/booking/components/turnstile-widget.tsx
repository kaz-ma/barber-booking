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
 * the normal case (WCAG 3.3.8). `resetOn` changes to a new non-null value after a failed submit
 * (bot_check_failed) to issue a fresh token. TODO(turnstile slice): verify against real keys.
 */
export function TurnstileWidget({
  siteKey,
  locale,
  onToken,
  resetOn,
}: {
  siteKey: string
  locale: string
  onToken: (token: string) => void
  resetOn?: unknown
}) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)

  const render = useCallback(() => {
    if (!ref.current || !window.turnstile || widgetId.current) return
    widgetId.current = window.turnstile.render(ref.current, {
      sitekey: siteKey,
      action: TURNSTILE_ACTION,
      appearance: 'interaction-only',
      language: locale,
      callback: (token: string) => onToken(token),
      'expired-callback': () => {
        onToken('')
        window.turnstile?.reset(widgetId.current ?? undefined)
      },
    })
  }, [siteKey, locale, onToken])

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
