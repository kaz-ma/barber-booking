import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { FlowHeader } from '@/components/ui/header'
import { BookingInfoForm } from '@/features/booking/components/booking-info-form'
import { BookingStepper, StepAnnouncer } from '@/features/booking/components/booking-stepper'
import { DraftBackLink } from '@/features/booking/components/draft-back-link'
import { getActiveMenus } from '@/features/settings/queries'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('infoTitle'), robots: { index: false } }
}

/** S-C-02b ③: static shell + client form (selection from the query string / draft). */
export default async function BookInfoPage() {
  const [menus, tNav] = await Promise.all([getActiveMenus(), getTranslations('nav')])
  return (
    <>
      <FlowHeader back={<DraftBackLink to="time" label={tNav('backToTime')} />} />
      <main id="main" className="wrap">
        <BookingStepper current="info" />
        <StepAnnouncer current="info" />
        <Suspense fallback={<div className="min-h-96" aria-hidden="true" />}>
          <BookingInfoForm menus={menus} />
        </Suspense>
      </main>
    </>
  )
}
