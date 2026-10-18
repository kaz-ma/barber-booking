'use client'

import { type ReactNode, useEffect, useRef } from 'react'

/**
 * The access map's figure. Once on screen, the walking route draws itself and the shop pin
 * drops in (A4, globals.css `.amap.anim`). Without JS, or with reduced motion, the finished map
 * is shown as is.
 */
export function MapReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Already scrolled past (e.g. a reload halfway down): leave the finished map.
    if (el.getBoundingClientRect().bottom < 0) return
    el.classList.add('anim')
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add('in-view')
          io.disconnect()
        }
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <figure ref={ref} className="amap">
      {children}
    </figure>
  )
}
