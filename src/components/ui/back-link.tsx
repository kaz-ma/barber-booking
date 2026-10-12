import type { ComponentProps } from 'react'
import { Link } from '@/lib/i18n/navigation'
import { Icon } from './icon'

/** 44×44 "←" link for the booking header; the label names the destination. */
export function BackLink({ href, label }: { href: ComponentProps<typeof Link>['href']; label: string }) {
  return (
    <Link className="back" href={href} aria-label={label}>
      <Icon name="arrowLeft" />
    </Link>
  )
}
