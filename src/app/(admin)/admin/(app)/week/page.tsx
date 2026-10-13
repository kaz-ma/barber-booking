import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { isDateString } from '@/domain/time'

/** S-A-03 週 is folded into the week strip of the 予約 screen (2026-10-13). Old links land there. */
export default function WeekPage({ searchParams }: PageProps<'/admin/week'>) {
  return (
    <Suspense fallback={null}>
      <ToDay searchParams={searchParams} />
    </Suspense>
  )
}

async function ToDay({ searchParams }: Pick<PageProps<'/admin/week'>, 'searchParams'>): Promise<null> {
  const sp = await searchParams
  const start = typeof sp.start === 'string' && isDateString(sp.start) ? sp.start : null
  redirect((start ? `/admin?date=${start}` : '/admin') as Route)
}
