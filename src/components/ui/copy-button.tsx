'use client'

import { useEffect, useRef, useState } from 'react'
import { buttonClass } from './button'
import { Icon } from './icon'

async function copyText(text: string, fallbackTarget?: HTMLElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Clipboard API unavailable / denied: select the text so the person can copy it manually.
    if (fallbackTarget) {
      const range = document.createRange()
      range.selectNodeContents(fallbackTarget)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    return false
  }
}

function useFlash(ms = 2000) {
  const [on, setOn] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), [])
  return [
    on,
    () => {
      setOn(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setOn(false), ms)
    },
  ] as const
}

type Labels = { label: string; copiedLabel: string; liveMessage: string }

/**
 * CopyButton (DG-001 §5.8): copies `value`, swaps its label to "コピーしました ✓" for 2 s with a
 * fixed width (no layout shift) and announces through an aria-live region.
 */
export function CopyButton({
  value,
  label,
  copiedLabel,
  liveMessage,
  selectFallbackId,
  ariaLabel,
}: Labels & { value: string; selectFallbackId?: string; ariaLabel?: string }) {
  const [copied, flash] = useFlash()
  return (
    <>
      <button
        type="button"
        className={buttonClass({ variant: 'secondary', size: 'sm' })}
        aria-label={copied ? undefined : ariaLabel}
        onClick={async () => {
          const ok = await copyText(value, selectFallbackId ? document.getElementById(selectFallbackId) : null)
          if (ok) flash()
        }}
      >
        <Icon name={copied ? 'check' : 'copy'} />
        <span className="grid">
          <span className={copied ? 'invisible col-start-1 row-start-1' : 'col-start-1 row-start-1'}>{label}</span>
          <span
            className={copied ? 'col-start-1 row-start-1' : 'invisible col-start-1 row-start-1'}
            aria-hidden={!copied}
          >
            {copiedLabel}
          </span>
        </span>
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? liveMessage : ''}
      </span>
    </>
  )
}

/**
 * ShareCopyButton (DES-07): Web Share sheet when available (LINE, Notes, …); otherwise, or on
 * any failure other than the person dismissing the sheet (AbortError), copy to the clipboard.
 */
export function ShareCopyButton({
  url,
  title,
  text,
  label,
  copiedLabel,
  liveMessage,
  selectFallbackId,
}: Labels & { url: string; title: string; text?: string; selectFallbackId?: string }) {
  const [copied, flash] = useFlash()
  async function onClick() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url })
        return
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    const ok = await copyText(url, selectFallbackId ? document.getElementById(selectFallbackId) : null)
    if (ok) flash()
  }
  return (
    <>
      <button type="button" className={buttonClass({ variant: 'secondary', size: 'sm' })} onClick={onClick}>
        <Icon name={copied ? 'check' : 'share'} />
        <span className="grid">
          <span className={copied ? 'invisible col-start-1 row-start-1' : 'col-start-1 row-start-1'}>{label}</span>
          <span
            className={copied ? 'col-start-1 row-start-1' : 'invisible col-start-1 row-start-1'}
            aria-hidden={!copied}
          >
            {copiedLabel}
          </span>
        </span>
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? liveMessage : ''}
      </span>
    </>
  )
}
