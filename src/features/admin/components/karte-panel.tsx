'use client'

import Image from 'next/image'
import { useState, useTransition } from 'react'
import { BarberPole } from '@/components/ui/barber-pole'
import { formatDateJa } from '@/domain/jst-format'
import { addKartePhotoAction, deleteKartePhotoAction, saveKarteNoteAction } from '../actions'
import type { BookingKarte, KarteEntry } from '../karte'
import { errorText, S } from '../strings'
import { Icon } from './icon'
import { useToast } from './toast'
import { describeFailure } from './use-admin-action'

const MAX_SIDE = 1280

/** Shrinks a camera photo to a JPEG of at most 1280 px before upload (~150 KB). */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const g = canvas.getContext('2d')
  if (!g) throw new Error('no canvas')
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  for (const q of [0.8, 0.65, 0.5]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q))
    if (blob && blob.size <= 550 * 1024) return blob
  }
  throw new Error('too large')
}

const photoUrl = (id: string) => `/api/admin/karte-photos/${id}`

function Photos({ entry, onDelete }: { entry: KarteEntry; onDelete?: (id: string) => void }) {
  if (entry.photos.length === 0) return null
  return (
    <ul className="kt-photos">
      {entry.photos.map((p) => (
        <li key={p.id}>
          <a href={photoUrl(p.id)} target="_blank" rel="noreferrer" aria-label={S.karte.openPhoto}>
            {/* Private, auth-only route: served as is, not through the image optimizer. */}
            <Image src={photoUrl(p.id)} alt="" width={p.width} height={p.height} unoptimized />
          </a>
          {onDelete ? (
            <button type="button" className="kt-del" aria-label={S.karte.deletePhoto} onClick={() => onDelete(p.id)}>
              <Icon name="x" />
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/** Previous visit's notes (read-only), shared by the booking detail and the next-customer card. */
export function PreviousKarte({ entry, label = S.karte.previous }: { entry: KarteEntry; label?: string }) {
  return (
    <div className="kt-prev">
      <p className="kt-prev-h">
        {label} <span className="num">{formatDateJa(entry.date)}</span>
        {entry.menuName ? ` ${entry.menuName}` : ''}
      </p>
      {entry.body ? <p className="kt-body">{entry.body}</p> : null}
      <Photos entry={entry} />
    </div>
  )
}

/**
 * B3 カルテ on the booking detail: this visit's notes (saved when the field loses focus) and
 * photos, with the previous visit's notes above for reference. Photos need the customer's
 * agreement once; the owner ticks it and it is recorded as a consent.
 */
export function KartePanel({ bookingId, karte }: { bookingId: string; karte: BookingKarte }) {
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [body, setBody] = useState(karte.current?.body ?? '')
  const [saved, setSaved] = useState(karte.current?.body ?? '')
  const [consent, setConsent] = useState(false)
  const [uploading, setUploading] = useState(false)
  const needsConsent = !karte.hasPhotoConsent
  const current: KarteEntry = karte.current ?? {
    id: '',
    bookingId,
    date: '',
    menuName: null,
    body: null,
    photos: [],
  }

  function save() {
    if (body === saved) return
    startTransition(async () => {
      const res = await saveKarteNoteAction({ bookingId, body })
      const failure = describeFailure(res)
      if (failure) {
        toast.show({ message: failure })
        return
      }
      setSaved(body)
      toast.show({ message: S.karte.saved, placement: 'bottom', icon: true })
    })
  }

  async function upload(file: File) {
    setUploading(true)
    try {
      const blob = await shrink(file)
      const form = new FormData()
      form.set('bookingId', bookingId)
      form.set('consent', consent ? '1' : '0')
      form.set('photo', blob, 'photo.jpg')
      const res = await addKartePhotoAction(form)
      if (res.status === 'invalid') {
        toast.show({ message: errorText(Object.values(res.fieldErrors)[0]?.[0]) })
        return
      }
      const failure = describeFailure(res)
      toast.show({ message: failure ?? S.karte.photoAdded, placement: 'bottom', icon: !failure })
    } catch {
      toast.show({ message: S.karte.photoFailed })
    } finally {
      setUploading(false)
    }
  }

  function remove(photoId: string) {
    if (!window.confirm(S.karte.deleteConfirm)) return
    startTransition(async () => {
      const res = await deleteKartePhotoAction({ photoId })
      toast.show({ message: describeFailure(res) ?? S.karte.photoDeleted, placement: 'bottom' })
    })
  }

  return (
    <section className="v2-card kt" aria-labelledby="kt-h">
      <h2 id="kt-h" className="kt-h">
        <Icon name="note" />
        {S.karte.title}
      </h2>
      {karte.previous ? <PreviousKarte entry={karte.previous} /> : <p className="v2-cap">{S.karte.firstVisit}</p>}
      <div className="field">
        <label className="label" htmlFor="kt-body">
          {S.karte.thisTime}
        </label>
        <textarea
          id="kt-body"
          className="input"
          rows={3}
          maxLength={2000}
          placeholder={S.karte.placeholder}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={save}
        />
      </div>
      <Photos entry={current} onDelete={remove} />
      {current.photos.length < 6 ? (
        <>
          {needsConsent ? (
            <label className="v2-switch kt-consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>{S.karte.consent}</span>
            </label>
          ) : null}
          <label className={`btn btn-secondary btn-block ${needsConsent && !consent ? 'is-off' : ''}`}>
            <Icon name="addsq" />
            {S.karte.addPhoto}
            <input
              className="vh-input"
              type="file"
              accept="image/*"
              disabled={uploading || pending || (needsConsent && !consent)}
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void upload(f)
              }}
            />
          </label>
          {uploading ? <BarberPole /> : null}
        </>
      ) : null}
    </section>
  )
}
