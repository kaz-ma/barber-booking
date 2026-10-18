import type { Metadata } from 'next'
import { Suspense } from 'react'
import { requireAdminPage } from '@/features/admin/auth'
import { HoursSettings } from '@/features/admin/components/hours-settings'
import { RecurringList } from '@/features/admin/components/recurring-list'
import { SettingsHeader } from '@/features/admin/components/settings-nav'
import { getAdminHours, getAdminSettings } from '@/features/admin/queries'
import { listRecurringBlocks } from '@/features/admin/recurring'
import { S } from '@/features/admin/strings'

export const metadata: Metadata = { title: '営業時間' }

/** S-A-08 設定: 営業時間・休業日・枠ルール (FR-A-07). */
export default function HoursPage() {
  return (
    <div className="has-tabbar has-cta-tabs">
      <SettingsHeader title={S.settings.hours} back />
      <main className="wrap set">
        <Suspense fallback={<p className="help">{S.loading}</p>}>
          <Hours />
        </Suspense>
      </main>
    </div>
  )
}

async function Hours() {
  await requireAdminPage('/admin/settings/hours')
  const now = new Date()
  const [hours, settings, rules] = await Promise.all([getAdminHours(now), getAdminSettings(), listRecurringBlocks()])
  return (
    <>
      <HoursSettings hours={hours} settings={settings} />
      <RecurringList rules={rules} />
    </>
  )
}
