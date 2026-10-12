import { requireAdminPage } from '@/features/admin/auth'
import { AdminBoot } from '@/features/admin/components/admin-boot'
import { InboxProvider } from '@/features/admin/components/inbox-provider'
import { PushProvider } from '@/features/admin/components/push-provider'
import { TabBar } from '@/features/admin/components/tab-bar'
import { ToastProvider } from '@/features/admin/components/toast'
import { getInboxCount } from '@/features/admin/queries'
import { env } from '@/lib/env'

export const instant = false

/** Signed-in admin chrome: polling, push state, toasts and the bottom tabs (S-A-02..11). */
export default async function AdminAppLayout({ children }: LayoutProps<'/admin'>) {
  await requireAdminPage()
  const inbox = await getInboxCount()
  return (
    <ToastProvider>
      <InboxProvider initialCount={inbox.unacknowledged} initialLatest={inbox.latestChangeAt}>
        <PushProvider vapidPublicKey={env.VAPID_PUBLIC_KEY ?? null}>
          <AdminBoot />
          {children}
          <TabBar />
        </PushProvider>
      </InboxProvider>
    </ToastProvider>
  )
}
