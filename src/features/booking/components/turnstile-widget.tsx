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
 * Cloudflare Turnstile, managed mode, explicit render (08_security.md §7).
 * Minimal wiring: TODO(turnstile slice) verify against real keys, reset after a failed
 * submit, Instagram DM fallback copy when the widget cannot load.
 */
export function TurnstileWidget({
  siteKey,
  locale,
  onToken,
}: {
  siteKey: string
  locale: string
  onToken: (token: string) => void
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

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={render}
      />
      <div ref={ref} />
    </>
  )
}
