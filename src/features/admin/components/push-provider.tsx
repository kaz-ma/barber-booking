'use client'

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { subscribePushAction, touchPushSubscriptionAction } from '../actions'
import {
  currentSubscription,
  detectPlatform,
  isStandalone,
  pushSupported,
  registerServiceWorker,
  subscriptionJson,
  urlBase64ToUint8Array,
} from './push-client'

/*
 * Push subscription state for this device (05 §6, S-A-10 §9.1). Checked at launch and on
 * visibilitychange: getSubscription() decides (iOS reports Notification.permission "default"
 * even when notifications are off in Settings). A known subscription is touched (last_seen_at);
 * one the server forgot is re-registered without prompting.
 */

export type PushState =
  | 'checking'
  | 'unsupported'
  | 'not-standalone'
  | 'unsubscribed'
  | 'subscribed'
  | 'blocked'
  | 'no-key'

type PushCtx = {
  state: PushState
  endpoint: string | null
  enable: () => Promise<PushState>
  rebuild: () => Promise<PushState>
  disable: () => Promise<void>
}

const PushContext = createContext<PushCtx | null>(null)

export function usePush(): PushCtx {
  const ctx = useContext(PushContext)
  if (!ctx) throw new Error('usePush outside PushProvider')
  return ctx
}

/** Reads the device state without touching React state (all awaits happen first). */
async function probePushState(): Promise<{ state: PushState; endpoint: string | null; subscription: PushSubscription | null }> {
  if (!pushSupported()) return { state: 'unsupported', endpoint: null, subscription: null }
  await registerServiceWorker()
  if (!isStandalone() && detectPlatform() === 'ios') return { state: 'not-standalone', endpoint: null, subscription: null }
  const sub = await currentSubscription()
  if (!sub) {
    return { state: Notification.permission === 'denied' ? 'blocked' : 'unsubscribed', endpoint: null, subscription: null }
  }
  return { state: 'subscribed', endpoint: sub.endpoint, subscription: sub }
}

export function PushProvider({ vapidPublicKey, children }: { vapidPublicKey: string | null; children: ReactNode }) {
  const [state, setState] = useState<PushState>('checking')
  const [endpoint, setEndpoint] = useState<string | null>(null)

  const check = useCallback(async () => {
    const result = await probePushState()
    setEndpoint(result.endpoint)
    setState(result.state)
    if (result.subscription) {
      const sub = result.subscription
      const touched = await touchPushSubscriptionAction({ endpoint: sub.endpoint })
      if (touched.status === 'ok' && !touched.data.known) {
        await subscribePushAction({ subscription: subscriptionJson(sub), platform: detectPlatform() })
      }
    }
  }, [])

  useEffect(() => {
    void check()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [check])

  const subscribe = useCallback(
    async (replaceEndpoint?: string): Promise<PushState> => {
      if (!vapidPublicKey) {
        setState('no-key')
        return 'no-key'
      }
      const reg = (await navigator.serviceWorker.getRegistration('/admin')) ?? (await registerServiceWorker())
      if (!reg) return 'unsupported'
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
      const res = await subscribePushAction({
        subscription: subscriptionJson(sub),
        platform: detectPlatform(),
        ...(replaceEndpoint ? { replaceEndpoint } : {}),
      })
      if (res.status !== 'ok') throw new Error(res.status)
      setEndpoint(sub.endpoint)
      setState('subscribed')
      return 'subscribed'
    },
    [vapidPublicKey],
  )

  /** Must be called directly from a tap handler (iOS requires the user gesture). */
  const enable = useCallback(async (): Promise<PushState> => {
    if (!pushSupported()) return 'unsupported'
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      setState('blocked')
      return 'blocked'
    }
    try {
      return await subscribe()
    } catch {
      setState('blocked')
      return 'blocked'
    }
  }, [subscribe])

  /** "届かない" -> unsubscribe and subscribe again (APNs 201 but not delivered, AT-14). */
  const rebuild = useCallback(async (): Promise<PushState> => {
    const old = await currentSubscription()
    const oldEndpoint = old?.endpoint
    await old?.unsubscribe().catch(() => false)
    try {
      return await subscribe(oldEndpoint)
    } catch {
      setState('blocked')
      return 'blocked'
    }
  }, [subscribe])

  const disable = useCallback(async () => {
    const sub = await currentSubscription()
    await sub?.unsubscribe().catch(() => false)
    setEndpoint(null)
    setState('unsubscribed')
  }, [])

  return <PushContext.Provider value={{ state, endpoint, enable, rebuild, disable }}>{children}</PushContext.Provider>
}
