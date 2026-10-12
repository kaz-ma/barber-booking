import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { FlowHeader } from '@/components/ui/header'
import { BookingStepper, StepAnnouncer } from '@/features/booking/components/booking-stepper'
import { ConfirmForm } from '@/features/booking/components/confirm-form'
import { DraftBackLink } from '@/features/booking/components/draft-back-link'
import { getActiveMenus, getPublicSettings } from '@/features/settings/queries'
import { env } from '@/lib/env'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('confirmTitle'), robots: { index: false } }
}

/** S-C-04 ④. The Turnstile site key is passed from the server as a prop (no NEXT_PUBLIC_, CON-05). */
export default async function BookConfirmPage() {
  const [menus, settings, tNav] = await Promise.all([getActiveMenus(), getPublicSettings(), getTranslations('nav')])
  return (
    <>
      <FlowHeader back={<DraftBackLink to="info" label={tNav('backToInfo')} />} />
      <main id="main" className="wrap">
        <BookingStepper current="confirm" />
        <StepAnnouncer current="confirm" />
        <ConfirmForm
          menus={menus}
          turnstileSiteKey={env.TURNSTILE_SITE_KEY}
          cancelDeadlineMin={settings.cancelDeadlineMin}
        />
      </main>
    </>
  )
}
