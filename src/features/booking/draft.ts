/**
 * Booking draft shared by S-C-03 .. S-C-04 (03_screen_specs.md §1.4). sessionStorage only:
 * it contains the phone number, so it is limited to the tab and discarded after 30 minutes
 * of inactivity or on completion.
 */
import { useSyncExternalStore } from 'react'

export const DRAFT_KEY = 'bb.bookingDraft.v1'
const NONCE_KEY = 'bb.submissionNonce.v1'
const MAX_AGE_MS = 30 * 60 * 1000

export type Draft = {
  menuSlug: string
  startsAt: string
  name: string
  nameKana: string
  occupation: 'student' | 'worker' | ''
  phone: string
  note: string
}

function parseDraft(raw: string | null): Draft | null {
  if (!raw) return null
  try {
    const { savedAt, draft } = JSON.parse(raw) as { savedAt: number; draft: Draft }
    return Date.now() - savedAt > MAX_AGE_MS ? null : draft
  } catch {
    return null
  }
}

function readRaw(): string | null {
  try {
    return sessionStorage.getItem(DRAFT_KEY)
  } catch {
    return null
  }
}

export function loadDraft(): Draft | null {
  return parseDraft(readRaw())
}

// useSyncExternalStore needs a referentially stable snapshot: cache by the raw string.
let cachedRaw: string | null | undefined
let cachedDraft: Draft | null = null
const listeners = new Set<() => void>()

function snapshot(): Draft | null {
  const raw = readRaw()
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedDraft = parseDraft(raw)
  }
  return cachedDraft
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** `undefined` during SSR / hydration, then the stored draft (or null). */
export function useDraft(): Draft | null | undefined {
  return useSyncExternalStore(subscribe, snapshot, () => undefined)
}

/** Stable per-tab nonce; `''` during SSR / hydration. */
export function useSubmissionNonce(): string {
  return useSyncExternalStore(subscribe, submissionNonce, () => '')
}

export function saveDraft(draft: Draft): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), draft }))
  } catch {
    // storage unavailable (private mode): the flow still works within the page
  }
  for (const l of listeners) l()
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
    sessionStorage.removeItem(NONCE_KEY)
  } catch {}
  memoryNonce = null
  for (const l of listeners) l()
}

let memoryNonce: string | null = null

/** One nonce per confirm attempt; re-sends from the same tab reuse it (G-04). */
export function submissionNonce(): string {
  try {
    const existing = sessionStorage.getItem(NONCE_KEY)
    if (existing) return existing
    const fresh = crypto.randomUUID()
    sessionStorage.setItem(NONCE_KEY, fresh)
    return fresh
  } catch {
    memoryNonce ??= crypto.randomUUID()
    return memoryNonce
  }
}
