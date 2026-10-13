'use client'

import { BackLink } from '@/components/ui/back-link'

/** "←" on the review page: back to the details step on the top page (the draft keeps everything). */
export function DraftBackLink({ label }: { label: string }) {
  return <BackLink href="/?step=info#book" label={label} />
}
