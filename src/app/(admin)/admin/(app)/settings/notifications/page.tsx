import type { Metadata } from 'next'
import { Suspense } from 'react'
import { requireAdminPage } from '@/features/admin/auth'
import { NotificationsPanel } from '@/features/admin/components/notifications-panel'
import { SettingsHeader, SettingsNav } from '@/features/admin/components/settings-nav'
import { countPasskeys, listDevices } from '@/features/admin/queries'
import { S } from '@/features/admin/strings'

export const metadata: Metadata = { title: '通知' }

/** S-A-10 通知設定・端末 (FR-A-09, 12, 16). */
export default function NotificationsPage() {
  return (
    <div className="has-tabbar">
      <SettingsHeader />
      <main className="wrap set">
        <SettingsNav current="notifications" />
        <Suspense fallback={<p className="help">{S.loading}</p>}>
          <Notifications />
        </Suspense>
      </main>
    </div>
  )
}

async function Notifications() {
  const session = await requireAdminPage('/admin/settings/notifications')
  const [devices, passkeys] = await Promise.all([
    listDevices(session.user.id, session.session.id),
    countPasskeys(session.user.id),
  ])
  return <NotificationsPanel sessions={devices.sessions} subscriptions={devices.subscriptions} passkeys={passkeys} />
}
