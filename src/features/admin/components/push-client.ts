/*
 * Browser helpers for Web Push (05_state_and_flows.md §6, research 09 §3.1). No React.
 * iOS rules: subscribe only in a home-screen app, call requestPermission() directly inside the
 * tap handler, treat "getSubscription() === null" (not Notification.permission) as the signal.
 */

export type PushPlatform = 'ios' | 'android' | 'desktop' | 'other'

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  )
}

export function detectPlatform(ua: string = navigator.userAgent): PushPlatform {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  if (/Windows|Macintosh|Linux|CrOS/.test(ua)) return 'desktop'
  return 'other'
}

/** Human device label from a user agent (端末一覧). Never shown outside the admin. */
export function deviceLabel(ua: string | null): string {
  if (!ua) return '不明な端末'
  const browser = /CriOS|Chrome/.test(ua)
    ? 'Chrome'
    : /Firefox|FxiOS/.test(ua)
      ? 'Firefox'
      : /Safari/.test(ua)
        ? 'Safari'
        : ''
  let device = 'ブラウザ'
  if (/iPhone/.test(ua)) device = 'iPhone'
  else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua))) device = 'iPad'
  else if (/Android/.test(ua)) device = 'Android'
  else if (/Macintosh/.test(ua)) device = 'Mac'
  else if (/Windows/.test(ua)) device = 'Windows'
  return browser && device !== 'iPhone' && device !== 'iPad' ? `${device} ・ ${browser}` : device
}

export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/admin', updateViaCache: 'none' })
    // iOS keeps old workers for a long time: ask for an update on every load.
    reg.update().catch(() => {})
    return reg
  } catch {
    return null
  }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration('/admin')
  if (!reg) return null
  return reg.pushManager.getSubscription()
}

export function subscriptionJson(sub: PushSubscription) {
  const json = sub.toJSON()
  return {
    endpoint: json.endpoint ?? sub.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
  }
}

export async function setBadge(count: number): Promise<void> {
  const nav = navigator as Navigator & {
    setAppBadge?: (n: number) => Promise<void>
    clearAppBadge?: () => Promise<void>
  }
  try {
    if (count > 0) await nav.setAppBadge?.(count)
    else await nav.clearAppBadge?.()
  } catch {
    // Badging is optional.
  }
}
