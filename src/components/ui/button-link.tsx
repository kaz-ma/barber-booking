import type { ComponentProps } from 'react'
import { Link } from '@/lib/i18n/navigation'

/** Primary CTA styled link (accent is reserved for CTAs and "selected", DG-001). */
export function ButtonLink({ className = '', ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className={`inline-flex min-h-14 items-center justify-center rounded-sm bg-accent px-6 font-bold text-on-accent hover:bg-accent-pressed ${className}`}
    />
  )
}
