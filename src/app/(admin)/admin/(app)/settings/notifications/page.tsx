import type { Metadata } from 'next'
import { Suspense } from 'react'
import { requireAdminPage } from '@/features/admin/auth'
import { NotificationsPanel } from '@/features/admin/components/notifications-panel'
import { SettingsHeader } from '@/features/admin/components/settings-nav'
import { countPasskeys } from '@/features/admin/queries'
import { S } from '@/features/admin/strings'

export const metadata: Metadata = { title: '通知とログイン' }

/** S-A-10 通知とログイン (FR-A-09, 12, 16). */
export default function NotificationsPage() {
  return (
    <div className="has-tabbar">
      <SettingsHeader title={S.settings.notifications} back />
      <main className="wrap set">
        <Suspense fallback={<p className="help">{S.loading}</p>}>
          <Notifications />
        </Suspense>
      </main>
    </div>
  )
}

async function Notifications() {
  const session = await requireAdminPage('/admin/settings/notifications')
  const passkeys = await countPasskeys(session.user.id)
  return <NotificationsPanel passkeys={passkeys} />
}
