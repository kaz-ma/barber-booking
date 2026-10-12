'use client'

import { useRouter } from 'next/navigation'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { S } from '../strings'
import { setBadge } from './push-client'
import { useToast } from './toast'
import { hardNavigate } from './client-hooks'

/*
 * Unread badge + polling (FR-A-11, NFR-AV-03, 05 §8): fetch /api/admin/inbox-count at launch,
 * on visibilitychange (visible) and every 20 s while visible; stop while hidden (saves Neon
 * compute). When `latestChangeAt` moves, router.refresh() re-renders the current view and an
 * in-app toast covers the case where no push banner was shown in the foreground.
 */

const POLL_MS = 20_000

type InboxCtx = { count: number; setCount: (n: number) => void; refreshNow: () => void }
const InboxContext = createContext<InboxCtx>({ count: 0, setCount: () => {}, refreshNow: () => {} })

export const useInbox = () => useContext(InboxContext)

export function InboxProvider({
  initialCount,
  initialLatest,
  children,
}: {
  initialCount: number
  initialLatest: string | null
  children: ReactNode
}) {
  const router = useRouter()
  const toast = useToast()
  const [count, setCountState] = useState(initialCount)
  const latest = useRef(initialLatest)
  const countRef = useRef(initialCount)

  const setCount = useCallback((n: number) => {
    countRef.current = n
    setCountState(n)
    void setBadge(n)
  }, [])

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/inbox-count', { cache: 'no-store', credentials: 'same-origin' })
      if (res.status === 401) {
        hardNavigate(`/admin/login?next=${encodeURIComponent(window.location.pathname)}`)
        return
      }
      if (!res.ok) return
      const data = (await res.json()) as { unacknowledged: number; latestChangeAt: string | null }
      const changed = data.latestChangeAt !== latest.current
      const grew = data.unacknowledged > countRef.current
      latest.current = data.latestChangeAt
      setCount(data.unacknowledged)
      if (changed) {
        router.refresh()
        if (grew) toast.show({ message: S.newBookingToast, placement: 'top' })
      }
    } catch {
      // Offline: keep the last known state; the next visible tick retries.
    }
  }, [router, setCount, toast])

  useEffect(() => {
    void setBadge(initialCount)
  }, [initialCount])

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (timer) return
      timer = setInterval(() => void poll(), POLL_MS)
    }
    const stop = () => {
      if (timer) clearInterval(timer)
      timer = null
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void poll()
        start()
      } else stop()
    }
    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [poll])

  return (
    <InboxContext.Provider value={{ count, setCount, refreshNow: () => void poll() }}>{children}</InboxContext.Provider>
  )
}
