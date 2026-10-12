'use client'

import { type ReactNode, type RefObject, useEffect, useRef } from 'react'

/**
 * Sheet / Dialog on the native <dialog> (C-03): showModal() gives the focus trap, inert
 * background, Esc to close and the backdrop. Initial focus goes to `initialFocus` (e.g. the
 * safe "keep" action); focus returns to the trigger when it closes.
 */
export function Sheet({
  open,
  onClose,
  titleId,
  descriptionId,
  initialFocus,
  children,
}: {
  open: boolean
  onClose: () => void
  titleId: string
  descriptionId?: string
  initialFocus?: RefObject<HTMLElement | null>
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const returnTo = useRef<Element | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      returnTo.current = document.activeElement
      dialog.showModal()
      initialFocus?.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, initialFocus])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const handleClose = () => {
      onClose()
      const el = returnTo.current
      if (el instanceof HTMLElement && el.isConnected) el.focus()
    }
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose])

  return (
    <dialog ref={ref} className="bsheet" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <div className="grip" aria-hidden="true" />
      {open ? children : null}
    </dialog>
  )
}
