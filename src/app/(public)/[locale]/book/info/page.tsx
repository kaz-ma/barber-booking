import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { BookingInfoForm } from '@/features/booking/components/booking-info-form'
import { BookingStepper } from '@/features/booking/components/booking-stepper'
import { getActiveMenus } from '@/features/settings/queries'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('infoTitle') }
}

/** S-C-02b: static shell + client form (selection comes from the query string / draft). */
export default async function BookInfoPage() {
  const [menus, t] = await Promise.all([getActiveMenus(), getTranslations('booking.steps')])
  return (
    <>
      <BookingStepper current="info" />
      <h1 className="mb-4 text-2xl font-bold">{t('info')}</h1>
      <Suspense>
        <BookingInfoForm menus={menus} />
      </Suspense>
    </>
  )
}
