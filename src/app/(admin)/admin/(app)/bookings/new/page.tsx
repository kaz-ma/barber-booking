import type { Metadata } from 'next'
import { Suspense } from 'react'
import { isDateString, jstDate } from '@/domain/time'
import { requireAdminPage } from '@/features/admin/auth'
import { ManualBookingForm } from '@/features/admin/components/manual-booking-form'
import { getAdminMenus } from '@/features/admin/queries'
import { S } from '@/features/admin/strings'

export const metadata: Metadata = { title: '手動予約' }

/** S-A-05 手動予約 (FR-A-05). `?date=YYYY-MM-DD&start=HH:MM` pre-fill from the timeline. */
export default function ManualBookingPage({ searchParams }: PageProps<'/admin/bookings/new'>) {
  return (
    <Suspense fallback={<p className="wrap form">{S.loading}</p>}>
      <ManualBooking searchParams={searchParams} />
    </Suspense>
  )
}

async function ManualBooking({ searchParams }: Pick<PageProps<'/admin/bookings/new'>, 'searchParams'>) {
  await requireAdminPage('/admin/bookings/new')
  const sp = await searchParams
  const date = typeof sp.date === 'string' && isDateString(sp.date) ? sp.date : jstDate(new Date())
  const start = typeof sp.start === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(sp.start) ? sp.start : null
  const menus = await getAdminMenus()
  return <ManualBookingForm menus={menus} initialDate={date} initialStart={start} />
}
