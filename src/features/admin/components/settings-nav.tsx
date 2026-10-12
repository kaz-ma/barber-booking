import Link from 'next/link'
import { S } from '../strings'

type Item = 'hours' | 'menus' | 'notifications' | 'customers'

const ITEMS: {
  key: Item
  href: '/admin/settings/hours' | '/admin/settings/menus' | '/admin/settings/notifications' | '/admin/customers'
  label: string
}[] = [
  { key: 'hours', href: '/admin/settings/hours', label: S.settings.hours },
  { key: 'menus', href: '/admin/settings/menus', label: S.settings.menus },
  { key: 'notifications', href: '/admin/settings/notifications', label: S.settings.notifications },
  { key: 'customers', href: '/admin/customers', label: S.settings.customers },
]

/** Settings segment navigation (07/08 comps). */
export function SettingsNav({ current }: { current: Item }) {
  return (
    <nav className="segnav" aria-label={S.settings.nav}>
      {ITEMS.map((i) => (
        <Link key={i.key} href={i.href} aria-current={i.key === current ? 'page' : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  )
}

export function SettingsHeader() {
  return (
    <header className="ah set-head paper">
      <h1>{S.settings.title}</h1>
    </header>
  )
}
