'use client'

import { useEffect } from 'react'

/** Moves focus to `targetId` (a tabIndex={-1} heading) once, after the page renders. */
export function FocusOnMount({ targetId }: { targetId: string }) {
  useEffect(() => {
    document.getElementById(targetId)?.focus({ preventScroll: true })
  }, [targetId])
  return null
}
