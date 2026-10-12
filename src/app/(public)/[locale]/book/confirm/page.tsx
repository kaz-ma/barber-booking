import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { BookingStepper } from '@/features/booking/components/booking-stepper'
import { ConfirmForm } from '@/features/booking/components/confirm-form'
import { getActiveMenus } from '@/features/settings/queries'
import { env } from '@/lib/env'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('confirmTitle') }
}

/** S-C-04. The Turnstile site key is passed from the server as a prop (no NEXT_PUBLIC_, CON-05). */
export default async function BookConfirmPage() {
  const [menus, t] = await Promise.all([getActiveMenus(), getTranslations('confirm')])
  return (
    <>
      <BookingStepper current="confirm" />
      <h1 className="mb-4 text-2xl font-bold">{t('heading')}</h1>
      <ConfirmForm menus={menus} turnstileSiteKey={env.TURNSTILE_SITE_KEY} />
    </>
  )
}
