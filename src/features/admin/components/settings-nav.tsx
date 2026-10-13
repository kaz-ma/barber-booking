import Link from 'next/link'
import { S } from '../strings'
import { Icon, type IconName } from './icon'

type Item = 'hours' | 'menus' | 'notifications' | 'customers'

const ITEMS: {
  key: Item
  href: '/admin/settings/hours' | '/admin/settings/menus' | '/admin/settings/notifications' | '/admin/customers'
  label: string
  sub: string
  icon: IconName
}[] = [
  { key: 'menus', href: '/admin/settings/menus', label: S.settings.menus, sub: S.settings.menusSub, icon: 'note' },
  { key: 'hours', href: '/admin/settings/hours', label: S.settings.hours, sub: S.settings.hoursSub, icon: 'clock' },
  {
    key: 'notifications',
    href: '/admin/settings/notifications',
    label: S.settings.notifications,
    sub: S.settings.notificationsSub,
    icon: 'bell',
  },
  {
    key: 'customers',
    href: '/admin/customers',
    label: S.settings.customers,
    sub: S.settings.customersSub,
    icon: 'userplus',
  },
]

/** Settings index (simplified 2026-10-13): one row per area instead of segment tabs. */
export function SettingsList() {
  return (
    <ul className="v2-setlist">
      {ITEMS.map((i) => (
        <li key={i.key}>
          <Link href={i.href}>
            <Icon name={i.icon} />
            <span>
              <b>{i.label}</b>
              <small>{i.sub}</small>
            </span>
            <Icon name="chev-r" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Header of the settings screens; sub-screens get "←" back to the list. */
export function SettingsHeader({ title = S.settings.title, back = false }: { title?: string; back?: boolean }) {
  return (
    <header className="ah set-head paper">
      {back ? (
        <Link className="icon-btn" href="/admin/settings" aria-label={S.settings.backToList}>
          <Icon name="back" />
        </Link>
      ) : null}
      <h1>{title}</h1>
    </header>
  )
}
