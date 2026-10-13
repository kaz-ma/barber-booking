'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { S } from '../strings'
import { Icon, type IconName } from './icon'
import { useInbox } from './inbox-provider'

/** BottomTabs (simplified 2026-10-13): 予約 / お知らせ / 設定. Hidden on full-screen task pages. */
const TABS: {
  href: '/admin' | '/admin/inbox' | '/admin/settings'
  label: string
  icon: IconName
  match: (p: string) => boolean
}[] = [
  { href: '/admin', label: S.tabs.today, icon: 'today', match: (p) => p === '/admin' || p.startsWith('/admin/week') },
  { href: '/admin/inbox', label: S.tabs.inbox, icon: 'inbox', match: (p) => p.startsWith('/admin/inbox') },
  {
    href: '/admin/settings',
    label: S.tabs.settings,
    icon: 'settings',
    match: (p) => p.startsWith('/admin/settings') || p.startsWith('/admin/customers'),
  },
]

const FULL_SCREEN = [/^\/admin\/bookings\//, /^\/admin\/blocks\//]

export function TabBar() {
  const pathname = usePathname()
  const { count } = useInbox()
  if (FULL_SCREEN.some((re) => re.test(pathname))) return null
  return (
    <nav className="tabbar" aria-label={S.tabs.main}>
      <ul>
        {TABS.map((t) => {
          const current = t.match(pathname)
          return (
            <li key={t.href}>
              <Link className="tab" href={t.href} aria-current={current ? 'page' : undefined}>
                <Icon name={t.icon} />
                {t.icon === 'inbox' && count > 0 ? (
                  <b className="tbadge" aria-hidden="true">
                    {count}
                  </b>
                ) : null}
                <span>
                  {t.label}
                  {t.icon === 'inbox' && count > 0 ? <span className="vh">{S.inboxTabVh(count)}</span> : null}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
