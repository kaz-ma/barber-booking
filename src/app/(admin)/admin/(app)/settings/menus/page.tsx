import type { Metadata } from 'next'
import { Suspense } from 'react'
import { requireAdminPage } from '@/features/admin/auth'
import { MenusSettings } from '@/features/admin/components/menus-settings'
import { SettingsHeader } from '@/features/admin/components/settings-nav'
import { getAdminHours, getAdminMenus, getAdminSettings } from '@/features/admin/queries'
import { S } from '@/features/admin/strings'

export const metadata: Metadata = { title: 'メニュー' }

/** S-A-09 設定: メニュー (FR-A-08). */
export default function MenusPage() {
  return (
    <div className="has-tabbar">
      <SettingsHeader title={S.settings.menus} back />
      <main className="wrap set">
        <Suspense fallback={<p className="help">{S.loading}</p>}>
          <Menus />
        </Suspense>
      </main>
    </div>
  )
}

async function Menus() {
  await requireAdminPage('/admin/settings/menus')
  const [menus, hours, settings] = await Promise.all([getAdminMenus(), getAdminHours(), getAdminSettings()])
  // The most common opening hours drive the "last start" preview in the edit sheet (CR-15).
  const open = hours.week
    .filter((d) => !d.isClosed && d.openMin !== null && d.closeMin !== null)
    .map((d) => `${d.openMin}-${d.closeMin}`)
  const typicalKey = open.sort((a, b) => open.filter((v) => v === b).length - open.filter((v) => v === a).length)[0]
  const [openMin, closeMin] = typicalKey ? typicalKey.split('-').map(Number) : [18 * 60, 24 * 60]
  return (
    <MenusSettings
      menus={menus}
      typicalHours={{ openMin: openMin ?? 18 * 60, closeMin: closeMin ?? 24 * 60 }}
      slotStepMin={settings.slotStepMin}
    />
  )
}
