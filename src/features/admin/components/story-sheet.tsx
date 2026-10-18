'use client'

import Image from 'next/image'
import { useState } from 'react'
import { BarberPole } from '@/components/ui/barber-pole'
import { S } from '../strings'
import type { LinkMenu } from './booking-link-sheet'
import { Icon } from './icon'
import { Sheet } from './sheet'
import { useToast } from './toast'

/**
 * B5: this week's open times as a story image (GET /api/admin/story). The share sheet hands it
 * to Instagram (or saves it to Photos) on the phone; elsewhere it downloads.
 */
export function StorySheet({ open, onClose, menus }: { open: boolean; onClose: () => void; menus: LinkMenu[] }) {
  const toast = useToast()
  const [slug, setSlug] = useState(menus[0]?.slug ?? '')
  // Changes on every opening so the preview is never a stale image.
  const [stamp] = useState(() => Date.now())
  const [loaded, setLoaded] = useState<string | null>(null)
  const src = `/api/admin/story?${new URLSearchParams({ menu: slug, v: String(stamp) })}`

  async function share() {
    try {
      const blob = await (await fetch(src, { cache: 'no-store' })).blob()
      const file = new File([blob], 'neuer-barber-availability.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
        return
      }
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = file.name
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      toast.show({ message: S.story.failed })
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={S.story.title}>
      <div className="stack story">
        <p className="v2-cap">{S.story.lead}</p>
        {menus.length > 1 ? (
          <div className="field">
            <label className="label" htmlFor="st-menu">
              {S.story.menu}
            </label>
            <span className="select">
              <select id="st-menu" className="input" value={slug} onChange={(e) => setSlug(e.target.value)}>
                {menus.map((m) => (
                  <option key={m.slug} value={m.slug}>
                    {m.nameJa}（{m.durationMin}分）
                  </option>
                ))}
              </select>
              <Icon name="chev-d" />
            </span>
          </div>
        ) : null}
        <div className="story-preview">
          {loaded !== src ? <BarberPole /> : null}
          {open ? (
            <Image src={src} alt={S.story.alt} width={1080} height={1920} unoptimized onLoad={() => setLoaded(src)} />
          ) : null}
        </div>
        <button className="btn btn-primary btn-block" type="button" onClick={share}>
          <Icon name="share" />
          {S.story.share}
        </button>
      </div>
    </Sheet>
  )
}
