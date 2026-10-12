/**
 * Booking draft shared by S-C-03 .. S-C-04 (03_screen_specs.md §1.4). sessionStorage only:
 * it contains the phone number, so it is limited to the tab and discarded after 30 minutes
 * of inactivity or on completion.
 */
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

export function loadDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const { savedAt, draft } = JSON.parse(raw) as { savedAt: number; draft: Draft }
    if (Date.now() - savedAt > MAX_AGE_MS) {
      clearDraft()
      return null
    }
    return draft
  } catch {
    return null
  }
}

export function saveDraft(draft: Draft): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), draft }))
  } catch {
    // storage unavailable (private mode): the flow still works within the page
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
    sessionStorage.removeItem(NONCE_KEY)
  } catch {}
}

/** One nonce per confirm attempt; re-sends from the same tab reuse it (G-04). */
export function submissionNonce(): string {
  try {
    const existing = sessionStorage.getItem(NONCE_KEY)
    if (existing) return existing
    const fresh = crypto.randomUUID()
    sessionStorage.setItem(NONCE_KEY, fresh)
    return fresh
  } catch {
    return crypto.randomUUID()
  }
}
