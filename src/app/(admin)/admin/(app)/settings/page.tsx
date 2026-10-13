import type { Metadata } from 'next'
import { SettingsHeader, SettingsList } from '@/features/admin/components/settings-nav'

export const metadata: Metadata = { title: '設定' }

/** /admin/settings: the list of settings areas (simplified 2026-10-13). */
export default function SettingsIndex() {
  return (
    <div className="has-tabbar">
      <SettingsHeader />
      <main className="wrap v2-day">
        <SettingsList />
      </main>
    </div>
  )
}
