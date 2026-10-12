/* Admin PWA service worker (05_state_and_flows.md §7.2, ADR-0007). SW_VERSION 2026-10-12.1
 * push / notificationclick / pushsubscriptionchange only — no caching (FR-A-17 is later).
 * Registered from /admin with scope /admin; served with Cache-Control: no-cache (next.config.ts).
 * iOS 18.4+ shows `mutable:false` Declarative Web Push payloads without running this file; it
 * handles every other browser and older iOS with the same JSON. */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  // Always show a notification (iOS revokes permission after silent pushes; Chrome shows a
  // generic one). Never throw before showNotification.
  event.waitUntil(
    (async () => {
      let msg = null
      try {
        msg = event.data ? event.data.json() : null
      } catch {
        msg = null
      }
      const n = msg?.notification || {}
      try {
        await self.registration.showNotification(n.title || '予約管理', {
          body: n.body || '新しいお知らせがあります',
          lang: n.lang || 'ja',
          tag: n.tag,
          icon: '/icons/icon-192.png',
          data: Object.assign({ url: n.navigate || '/admin' }, n.data || {}),
        })
      } catch {
        await self.registration.showNotification('予約管理', { body: '新しいお知らせがあります' })
      }
      const badge = msg && (typeof msg.app_badge === 'number' ? msg.app_badge : n.app_badge)
      if (typeof badge === 'number' && 'setAppBadge' in self.navigator) {
        try {
          if (badge > 0) await self.navigator.setAppBadge(badge)
          else await self.navigator.clearAppBadge()
        } catch {}
      }
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  let target
  try {
    target = new URL(event.notification.data?.url || '/admin', self.location.origin)
  } catch {
    target = new URL('/admin', self.location.origin)
  }
  // Open-redirect guard (T-11): same origin and under /admin only.
  if (target.origin !== self.location.origin || !target.pathname.startsWith('/admin')) {
    target = new URL('/admin', self.location.origin)
  }
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // Do not match by URL: in an SPA client.url can be stale.
      const client = wins[0]
      if (client) {
        try {
          const navigated = await client.navigate(target.href)
          await (navigated || client).focus()
          return
        } catch {}
        try {
          client.postMessage({ type: 'NAVIGATE', path: target.pathname + target.search })
          await client.focus()
          return
        } catch {}
      }
      await self.clients.openWindow(target.href)
    })(),
  )
})

self.addEventListener('pushsubscriptionchange', (event) => {
  // Android / Chrome only (iOS never fires it; the app re-checks getSubscription() on launch).
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription
      const sub = event.newSubscription || (old && (await self.registration.pushManager.subscribe(old.options)))
      if (!sub) return
      await fetch('/api/admin/push/rotate', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ oldEndpoint: old ? old.endpoint : undefined, subscription: sub.toJSON() }),
      })
    })(),
  )
})
