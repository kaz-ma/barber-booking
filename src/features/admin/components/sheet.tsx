'use client'

import { type ReactNode, useEffect, useId, useRef } from 'react'
import { S } from '../strings'
import { Icon } from './icon'

/*
 * Bottom sheet (DG §2 "シート"): native <dialog> opened with showModal(), which gives
 * role="dialog" + aria-modal semantics, an inert background, focus containment and Esc.
 */
export function Sheet({
  open,
  onClose,
  title,
  titleIcon,
  className = '',
  children,
  hideClose = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  titleIcon?: ReactNode
  className?: string
  children: ReactNode
  hideClose?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`sheet ${className}`}
      aria-labelledby={titleId}
      aria-modal="true"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        // A click on the backdrop targets the dialog element itself.
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      {open ? (
        <>
          <div className="grip" aria-hidden="true" />
          <div className="sheet-head">
            <h2 id={titleId}>
              {titleIcon}
              {title}
            </h2>
            {hideClose ? null : (
              <button className="icon-btn" type="button" aria-label={S.close} onClick={onClose}>
                <Icon name="close" />
              </button>
            )}
          </div>
          {children}
        </>
      ) : null}
    </dialog>
  )
}
