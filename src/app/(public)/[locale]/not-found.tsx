import { useTranslations } from 'next-intl'
import { LinkButton } from '@/components/ui/button'
import { Footer } from '@/components/ui/footer'
import { SiteHeader } from '@/components/ui/header'
import { InstagramLink } from '@/components/ui/instagram-link'
import { Link } from '@/lib/i18n/navigation'

/** S-C-10 404 (08_notfound comp): 予約する + the single Instagram action (footer has none, HE-01). */
export default function NotFound() {
  const t = useTranslations('errors')
  const tNav = useTranslations('nav')
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap">
        <div className="nf">
          <p className="code404" aria-hidden="true">
            <b>404</b>
            <span lang="en">{t('notFoundCaps')}</span>
          </p>
          <h1 className="title-24">{t('notFound')}</h1>
          <p className="desc">{t('notFoundBody')}</p>
        </div>
        <div className="nf-actions">
          <LinkButton href="/book" variant="primary" block trailingIcon="arrowRight">
            {tNav('book')}
          </LinkButton>
          <InstagramLink variant="plain" />
          <div className="center-row">
            <Link className="btn btn-ghost" href="/">
              {t('toTop')}
            </Link>
          </div>
        </div>
      </main>
      <Footer showInstagram={false} />
    </>
  )
}
