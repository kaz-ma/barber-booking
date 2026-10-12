'use client'

import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { S } from '../strings'
import { Icon } from './icon'

/*
 * Toast (DG §2 "トースト"): inverse surface, role="status", optional 5-second undo with a
 * countdown ring. One at a time; a new toast replaces the current one.
 */

export type ToastInput = {
  message: string
  sub?: string
  /** Called when "取り消す" is pressed within the window. */
  undo?: () => Promise<void> | void
  durationMs?: number
  placement?: 'tabs' | 'bottom' | 'top'
  icon?: boolean
}

type Ctx = { show: (t: ToastInput) => void; dismiss: () => void; visible: boolean }

const ToastContext = createContext<Ctx | null>(null)

export function useToast(): Ctx {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast outside ToastProvider')
  return ctx
}

const CIRC = 62.8

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastInput & { id: number; startedAt: number }) | null>(null)
  const [now, setNow] = useState(0)
  const seq = useRef(0)

  const dismiss = useCallback(() => setToast(null), [])
  const show = useCallback((t: ToastInput) => {
    seq.current += 1
    const startedAt = Date.now()
    setNow(startedAt)
    setToast({ ...t, id: seq.current, startedAt })
  }, [])

  useEffect(() => {
    if (!toast) return
    const duration = toast.durationMs ?? (toast.undo ? 5000 : 3500)
    const tick = setInterval(() => setNow(Date.now()), 250)
    const timer = setTimeout(() => setToast((cur) => (cur?.id === toast.id ? null : cur)), duration)
    return () => {
      clearInterval(tick)
      clearTimeout(timer)
    }
  }, [toast])

  const duration = toast ? (toast.durationMs ?? (toast.undo ? 5000 : 3500)) : 0
  const left = toast ? Math.max(0, Math.ceil((toast.startedAt + duration - now) / 1000)) : 0
  const frac = toast ? Math.min(1, Math.max(0, (now - toast.startedAt) / duration)) : 0
  const placement = toast?.placement ?? 'tabs'

  return (
    <ToastContext.Provider value={{ show, dismiss, visible: toast !== null }}>
      {children}
      <div aria-live="polite" className="live">
        {toast ? `${toast.message}${toast.sub ? `。${toast.sub}` : ''}` : ''}
      </div>
      {toast ? (
        <div
          className={`toast ${placement === 'tabs' ? 'above-tabs' : placement === 'top' ? 'top' : ''}`}
          role="status"
          key={toast.id}
        >
          {toast.icon ? <Icon name="check" /> : null}
          <span className="msg">
            {toast.message}
            {toast.sub ? <small>{toast.sub}</small> : null}
          </span>
          {toast.undo ? (
            <button
              className="undo"
              type="button"
              onClick={async () => {
                const fn = toast.undo
                setToast(null)
                await fn?.()
              }}
            >
              {S.undo}
              <span className="count">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" strokeDasharray={CIRC} strokeDashoffset={CIRC * frac} />
                </svg>
                <span aria-hidden="true">{left}</span>
              </span>
              <span className="vh">{S.undoLeft(left)}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </ToastContext.Provider>
  )
}
