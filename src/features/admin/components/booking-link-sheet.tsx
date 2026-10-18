'use client'

import { useEffect, useRef, useState } from 'react'
import { BarberPole } from '@/components/ui/barber-pole'
import { formatDateJa } from '@/domain/jst-format'
import { S } from '../strings'
import { Icon } from './icon'
import { Sheet } from './sheet'
import { useToast } from './toast'

export type LinkMenu = { slug: string; nameJa: string; nameEn: string; durationMin: number }

type Slots = { status: 'error' } | { status: 'ok'; slots: string[] }

/**
 * B1 予約リンク: instead of typing a DM booking in by hand, the owner picks a menu and one of
 * the day's open times (the same GET /api/availability the customer page uses) and sends the
 * link. The customer lands on the top page with menu and time chosen and fills in their own
 * details; the usual pipeline (re-check, constraint, Turnstile) applies.
 */
export function BookingLinkSheet({
  open,
  onClose,
  date,
  menus,
}: {
  open: boolean
  onClose: () => void
  date: string
  menus: LinkMenu[]
}) {
  const toast = useToast()
  const [slug, setSlug] = useState(menus[0]?.slug ?? '')
  const [start, setStart] = useState<string | null>(null)
  const [lang, setLang] = useState<'ja' | 'en'>('ja')
  const [slots, setSlots] = useState<Record<string, Slots>>({})
  const key = `${slug}|${date}`
  const current = slots[key]

  // Each menu × day is fetched once per sheet; state is only set when the answer arrives.
  const requested = useRef(new Set<string>())
  useEffect(() => {
    if (!open || !slug || requested.current.has(key)) return
    requested.current.add(key)
    fetch(`/api/availability?${new URLSearchParams({ menu: slug, month: date.slice(0, 7) })}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as { days: { date: string; slots: string[] }[] }
        const list = data.days.find((d) => d.date === date)?.slots ?? []
        setSlots((s) => ({ ...s, [key]: { status: 'ok', slots: list } }))
      })
      .catch(() => {
        requested.current.delete(key)
        setSlots((s) => ({ ...s, [key]: { status: 'error' } }))
      })
  }, [open, slug, date, key])

  const menu = menus.find((m) => m.slug === slug)
  const url =
    start && menu
      ? `${window.location.origin}/${lang}?menu=${encodeURIComponent(menu.slug)}&start=${start.slice(0, 16)}#book`
      : ''
  const time = start ? start.slice(11, 16) : ''
  const dm = !url
    ? ''
    : lang === 'ja'
      ? S.link.dmJa(formatDateJa(date), time, menu?.nameJa ?? '', url)
      : S.link.dmEn(date, time, menu?.nameEn ?? '', url)

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.show({ message: done, placement: 'top', icon: true })
    } catch {
      toast.show({ message: S.detail.copyFailed, placement: 'top' })
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={S.link.title}>
      <div className="stack v2-link-sheet">
        <p className="v2-cap">{S.link.lead}</p>
        <div className="field">
          <label className="label" htmlFor="lk-menu">
            {S.link.menu}
          </label>
          <span className="select">
            <select
              id="lk-menu"
              className="input"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value)
                setStart(null)
              }}
            >
              {menus.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.nameJa}（{m.durationMin}分）
                </option>
              ))}
            </select>
            <Icon name="chev-d" />
          </span>
        </div>
        <div>
          <p className="label">{S.link.times(formatDateJa(date))}</p>
          {!current ? (
            <BarberPole className="v2-pole" />
          ) : current.status === 'error' ? (
            <p className="field-error">{S.link.loadError}</p>
          ) : current.slots.length === 0 ? (
            <p className="v2-cap">{S.link.none}</p>
          ) : (
            <ul className="v2-times-pick">
              {current.slots.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    className={`num ${start === s ? 'sel' : ''}`}
                    aria-pressed={start === s}
                    onClick={() => setStart(s)}
                  >
                    {s.slice(11, 16)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {url ? (
          <>
            <div className="seg-row" role="radiogroup" aria-label={S.manual.urlLocale}>
              {(['ja', 'en'] as const).map((l) => (
                <label key={l}>
                  <input
                    className="vh-input"
                    type="radio"
                    name="lk-lang"
                    checked={lang === l}
                    onChange={() => setLang(l)}
                  />
                  <span lang={l}>{l === 'ja' ? '日本語' : 'English'}</span>
                </label>
              ))}
            </div>
            <p className="dm" style={{ whiteSpace: 'pre-line' }}>
              {dm}
            </p>
            <button className="btn btn-primary btn-block" type="button" onClick={() => copy(dm, S.link.dmCopied)}>
              <Icon name="copy" />
              {S.link.copyDm}
            </button>
            <button className="btn btn-secondary btn-block" type="button" onClick={() => copy(url, S.link.urlCopied)}>
              <Icon name="copy" />
              {S.link.copyUrl}
            </button>
            <a className="btn btn-ghost" href={url} target="_blank" rel="noopener noreferrer">
              {S.detail.urlOpen}
            </a>
          </>
        ) : null}
      </div>
    </Sheet>
  )
}
