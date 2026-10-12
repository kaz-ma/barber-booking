'use client'

import { BackLink } from '@/components/ui/back-link'
import { useDraft } from '../draft'

/** "←" for steps 3–4: back to the previous step of the draft (time keeps menu, date and slot). */
export function DraftBackLink({ to, label }: { to: 'time' | 'info'; label: string }) {
  const draft = useDraft()
  if (to === 'info') return <BackLink href={{ pathname: '/book/info', query: { step: 'phone' } }} label={label} />
  if (!draft?.menuSlug) return <BackLink href="/book" label={label} />
  const query: Record<string, string> = { menu: draft.menuSlug }
  if (draft.startsAt) {
    query.date = draft.startsAt.slice(0, 10)
    query.sel = draft.startsAt
  }
  return <BackLink href={{ pathname: '/book/time', query }} label={label} />
}
