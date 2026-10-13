import type { Metadata } from 'next'
import { Suspense } from 'react'
import { requireAdminPage } from '@/features/admin/auth'
import { InboxList } from '@/features/admin/components/inbox-list'
import { getInbox } from '@/features/admin/queries'
import { S } from '@/features/admin/strings'

export const metadata: Metadata = { title: 'お知らせ' }

/** S-A-07 お知らせ (FR-A-11). Refreshed by the 20-second poll via router.refresh(). */
export default function InboxPage() {
  return (
    <div className="has-tabbar">
      <Suspense fallback={<p className="wrap ib">{S.loading}</p>}>
        <Inbox />
      </Suspense>
    </div>
  )
}

async function Inbox() {
  await requireAdminPage('/admin/inbox')
  const now = new Date()
  const { unread, read } = await getInbox(now)
  return <InboxList unread={unread} read={read} nowIso={now.toISOString()} />
}
