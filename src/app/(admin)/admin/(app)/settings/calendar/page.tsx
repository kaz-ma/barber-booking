import type { Metadata } from 'next'
import { Suspense } from 'react'
import { requireAdminPage } from '@/features/admin/auth'
import { hasCalendarFeed } from '@/features/admin/calendar-feed'
import { CalendarFeedPanel } from '@/features/admin/components/calendar-feed-panel'
import { SettingsHeader } from '@/features/admin/components/settings-nav'
import { S } from '@/features/admin/strings'

export const metadata: Metadata = { title: 'カレンダーに表示' }

/** B8: the owner's calendar subscription. */
export default function CalendarFeedPage() {
  return (
    <div className="has-tabbar">
      <SettingsHeader title={S.settings.calendar} back />
      <main className="wrap set">
        <Suspense fallback={<p className="help">{S.loading}</p>}>
          <Feed />
        </Suspense>
      </main>
    </div>
  )
}

async function Feed() {
  await requireAdminPage('/admin/settings/calendar')
  return <CalendarFeedPanel on={await hasCalendarFeed()} />
}
