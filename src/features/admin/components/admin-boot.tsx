'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { authClient } from '@/lib/auth-client'
import { detectPlatform, isStandalone } from './push-client'
import { hardNavigate } from './client-hooks'

/*
 * Launch-time housekeeping for the standalone admin app:
 *   - iPhone in a Safari tab -> S-A-12 install guidance (AT-11) unless "閲覧だけ" was chosen;
 *   - get-session through /api/auth (rolls the 30-day persistent cookie, at most hourly);
 *   - SW "NAVIGATE" messages from notificationclick -> client-side navigation.
 */
const BROWSE_ONLY_KEY = 'bb.admin.browse-only'
const SESSION_TOUCH_KEY = 'bb.admin.session-touched'

export function markBrowseOnly(): void {
  try {
    localStorage.setItem(BROWSE_ONLY_KEY, '1')
  } catch {}
}

export function AdminBoot() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    let browseOnly = false
    try {
      browseOnly = localStorage.getItem(BROWSE_ONLY_KEY) === '1'
    } catch {}
    if (!isStandalone() && detectPlatform() === 'ios' && !browseOnly) router.replace('/admin/install')
  }, [router])

  useEffect(() => {
    const touch = () => {
      let last = 0
      try {
        last = Number(sessionStorage.getItem(SESSION_TOUCH_KEY) ?? 0)
      } catch {}
      if (Date.now() - last < 3_600_000) return
      try {
        sessionStorage.setItem(SESSION_TOUCH_KEY, String(Date.now()))
      } catch {}
      void authClient.getSession().then((res) => {
        if (!res.data && !res.error)
          hardNavigate(`/admin/login?next=${encodeURIComponent(window.location.pathname)}`)
      })
    }
    touch()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') touch()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; path?: string } | null
      if (data?.type === 'NAVIGATE' && typeof data.path === 'string' && data.path.startsWith('/admin')) {
        router.push(data.path as '/admin')
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [router])

  return <span hidden data-path={pathname} />
}
