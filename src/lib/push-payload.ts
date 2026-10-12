/*
 * Shipped Declarative Web Push payload (05_state_and_flows.md §7.1, ADR-0007, FR-S-03).
 * Sent as the encrypted body with web-push's defaults (aes128gcm) — no Content-Type change.
 * iOS 18.4+ shows `mutable:false` payloads without waking the SW; other browsers and older iOS
 * go through public/sw.js, which reads the same JSON.
 * Never put phone numbers, names, notes or tokens in a payload (AGENTS.md rule 6).
 */

export type PushKind = 'created' | 'cancelled' | 'digest' | 'test'

export type DeclarativePushPayload = {
  web_push: 8030
  notification: {
    title: string
    body: string
    lang: 'ja'
    navigate: string
    tag: string
    silent: false
    data: Record<string, string | number>
    app_badge?: number
  }
  app_badge?: number
  mutable: false
}

export function buildDeclarativePayload(input: {
  title: string
  body: string
  /** Absolute same-origin URL under /admin (absoluteUrl()). */
  navigate: string
  tag: string
  data: Record<string, string | number>
  badge?: number
}): DeclarativePushPayload {
  const badge = typeof input.badge === 'number' ? { app_badge: input.badge } : {}
  return {
    web_push: 8030,
    notification: {
      title: input.title,
      body: input.body,
      lang: 'ja',
      navigate: input.navigate,
      tag: input.tag,
      silent: false,
      data: input.data,
      ...badge,
    },
    // Both positions until the iOS 26.x device test tells which one is honoured (AT-14).
    ...badge,
    mutable: false,
  }
}

/** `topic` must be URL-safe base64, ≤ 32 chars: 'b' + base64url(16 UUID bytes) = 23 chars. */
export function bookingTopic(bookingId: string): string {
  const hex = bookingId.replace(/-/g, '')
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error('bookingTopic expects a UUID')
  return `b${Buffer.from(hex, 'hex').toString('base64url')}`
}

/** Daily digest topic, e.g. d20261105. */
export function digestTopic(targetDate: string): string {
  return `d${targetDate.replace(/-/g, '')}`
}
