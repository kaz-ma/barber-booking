'use client'

import { useSyncExternalStore } from 'react'
import { detectPlatform, isStandalone, type PushPlatform } from './push-client'

/*
 * Browser-only values read without setState-in-effect: useSyncExternalStore gives the server
 * snapshot during SSR / hydration and the real value afterwards.
 */

const noopSubscribe = () => () => {}

export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
}

export function useStandalone(): boolean {
  return useSyncExternalStore(noopSubscribe, isStandalone, () => true)
}

export function usePlatform(): PushPlatform {
  return useSyncExternalStore(
    noopSubscribe,
    () => detectPlatform(),
    () => 'other',
  )
}

function subscribeMinute(onChange: () => void): () => void {
  const t = setInterval(onChange, 30_000)
  return () => clearInterval(t)
}

const minuteNow = () => Math.floor(Date.now() / 60_000) * 60_000

/** Current time rounded to the minute (re-renders every ~30 s); `null` during SSR. */
export function useNowMinute(): number | null {
  return useSyncExternalStore(subscribeMinute, minuteNow, () => null)
}

/** Full navigation (new document): used after login / logout so cookies apply everywhere. */
export function hardNavigate(path: string): void {
  window.location.assign(new URL(path, window.location.origin))
}
