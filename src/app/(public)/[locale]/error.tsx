'use client'

import { useTranslations } from 'next-intl'
import { Button, LinkButton } from '@/components/ui/button'
import { Footer } from '@/components/ui/footer'
import { SiteHeader } from '@/components/ui/header'
import { InstagramLink } from '@/components/ui/instagram-link'

/**
 * S-C-10 error boundary. Shows only the digest (matches server logs / Sentry), never error
 * details; offers a full reload (also recovers a page loaded before a redeploy, whose client
 * code no longer matches the server), 予約する and the single Instagram action (HE-01).
 * The booking draft lives in sessionStorage, so nothing typed is lost by reloading.
 */
export default function ErrorPage({ error }: { error: Error & { digest?: string } }) {
  const t = useTranslations('errors')
  const tNav = useTranslations('nav')
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap">
        <div className="nf">
          <p className="code404" aria-hidden="true">
            <b>!</b>
            <span lang="en">{t('errorCaps')}</span>
          </p>
          <h1 className="title-24">{t('generic')}</h1>
          <p className="desc">{t('genericBody')}</p>
          {error.digest ? <p className="mt-2 text-sm text-fg-muted">{t('errorId', { digest: error.digest })}</p> : null}
        </div>
        <div className="nf-actions">
          <Button variant="secondary" block onClick={() => window.location.reload()}>
            {t('retry')}
          </Button>
          <LinkButton href="/#book" variant="primary" block trailingIcon="arrowRight">
            {tNav('book')}
          </LinkButton>
          <InstagramLink variant="plain" />
        </div>
      </main>
      <Footer showInstagram={false} />
    </>
  )
}
