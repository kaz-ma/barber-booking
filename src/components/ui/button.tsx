import type { ComponentProps, ReactNode } from 'react'
import { Link } from '@/lib/i18n/navigation'
import { cx } from './cx'
import { Icon, type IconName } from './icon'

/*
 * Button (DG-001 §5.1). Labels are verbs (HE-04). Heights: primary 56, secondary 48, -sm 44,
 * ghost 44 — every target is ≥ 44px. Disabled primaries use aria-disabled (still focusable,
 * pressing shows an error) instead of fading.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-fill'
export type ButtonStyle = { variant?: ButtonVariant; size?: 'md' | 'sm'; block?: boolean; className?: string }

export function buttonClass({ variant = 'secondary', size = 'md', block = false, className }: ButtonStyle = {}) {
  return cx('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', block && 'btn-block', className)
}

type Decor = { icon?: IconName; trailingIcon?: IconName; children: ReactNode }

function Content({ icon, trailingIcon, children }: Decor) {
  return (
    <>
      {icon ? <Icon name={icon} /> : null}
      {children}
      {trailingIcon ? <Icon name={trailingIcon} /> : null}
    </>
  )
}

export function Button({
  variant,
  size,
  block,
  className,
  icon,
  trailingIcon,
  children,
  type = 'button',
  ...rest
}: ButtonStyle & Decor & Omit<ComponentProps<'button'>, 'className' | 'children'>) {
  return (
    <button type={type} className={buttonClass({ variant, size, block, className })} {...rest}>
      <Content icon={icon} trailingIcon={trailingIcon}>
        {children}
      </Content>
    </button>
  )
}

/** Internal, locale-aware link styled as a button. */
export function LinkButton({
  variant,
  size,
  block,
  className,
  icon,
  trailingIcon,
  children,
  ...rest
}: ButtonStyle & Decor & Omit<ComponentProps<typeof Link>, 'className' | 'children'>) {
  return (
    <Link className={buttonClass({ variant, size, block, className })} {...rest}>
      <Content icon={icon} trailingIcon={trailingIcon}>
        {children}
      </Content>
    </Link>
  )
}

/** External link styled as a button (new tab, no opener / referrer). */
export function ExternalButton({
  variant,
  size,
  block,
  className,
  icon,
  trailingIcon,
  children,
  newTab = true,
  ...rest
}: ButtonStyle & Decor & { newTab?: boolean } & Omit<ComponentProps<'a'>, 'className' | 'children'>) {
  return (
    <a
      className={buttonClass({ variant, size, block, className })}
      {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...rest}
    >
      <Content icon={icon} trailingIcon={trailingIcon}>
        {children}
      </Content>
    </a>
  )
}
