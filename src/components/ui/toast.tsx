'use client'

import { useEffect, useState } from 'react'

/** Toast (role="status"): announced politely, never steals focus, auto-hides after `duration`. */
export function Toast({ message, duration = 5000 }: { message: string; duration?: number }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const id = setTimeout(() => setVisible(false), duration)
    return () => clearTimeout(id)
  }, [duration])
  return (
    <div role="status" aria-live="polite">
      {visible ? <p className="toast">{message}</p> : null}
    </div>
  )
}
