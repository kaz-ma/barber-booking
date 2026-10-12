'use client'

import { useEffect, useRef } from 'react'

/**
 * After choosing another day (?date= changes, the page re-renders in place), move focus to the
 * slot-list heading without scrolling (03_screen_specs §2.4). Not on the first render.
 */
export function SlotsFocus({ date }: { date: string | null }) {
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (date) document.getElementById('slots-h')?.focus({ preventScroll: true })
  }, [date])
  return null
}
