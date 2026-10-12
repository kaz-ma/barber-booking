import type { ComponentProps, ElementType } from 'react'
import { cx } from './cx'

/** Card (DG-001 §5.2): plain card surface, subtle rule, grounded shadow. Never on paper texture. */
export function Card<T extends ElementType = 'div'>({
  as,
  className,
  ...rest
}: { as?: T; className?: string } & Omit<ComponentProps<T>, 'as' | 'className'>) {
  const Tag = (as ?? 'div') as ElementType
  return <Tag className={cx('card', className)} {...rest} />
}
