import type { Metadata } from 'next'
import { Suspense } from 'react'
import { requireAdminPage } from '@/features/admin/auth'
import { MenusSettings } from '@/features/admin/components/menus-settings'
import { SettingsHeader, SettingsNav } from '@/features/admin/components/settings-nav'
import { getAdminHours, getAdminMenus } from '@/features/admin/queries'
import { S } from '@/features/admin/strings'

export const metadata: Metadata = { title: 'メニュー' }

/** S-A-09 設定: メニュー (FR-A-08). */
export default function MenusPage() {
  return (
    <div className="has-tabbar">
      <SettingsHeader />
      <main className="wrap set">
        <SettingsNav current="menus" />
        <Suspense fallback={<p className="help">{S.loading}</p>}>
          <Menus />
        </Suspense>
      </main>
    </div>
  )
}

async function Menus() {
  await requireAdminPage('/admin/settings/menus')
  const [menus, hours] = await Promise.all([getAdminMenus(), getAdminHours()])
  // The most common closing time drives the "last start" preview in the edit sheet.
  const closes = hours.week.filter((d) => !d.isClosed && d.closeMin !== null).map((d) => d.closeMin as number)
  const typical =
    closes.sort((a, b) => closes.filter((v) => v === b).length - closes.filter((v) => v === a).length)[0] ?? 1440
  return <MenusSettings menus={menus} typicalCloseMin={typical} />
}
