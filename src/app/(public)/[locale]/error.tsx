'use client'

import { useTranslations } from 'next-intl'

/** S-C-10. Shows only the digest (matches server logs / Sentry), never error details. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errors')
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('generic')}</h1>
      {error.digest ? <p className="text-sm text-fg-muted">ID: {error.digest}</p> : null}
      <button type="button" onClick={reset} className="min-h-11 rounded-sm border border-border px-4">
        {t('retry')}
      </button>
    </div>
  )
}
