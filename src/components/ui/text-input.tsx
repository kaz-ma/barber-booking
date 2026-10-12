import type { ComponentProps } from 'react'
import { cx } from './cx'

/** 48px, 16px text (no iOS zoom), card surface, 1px border; invalid = 2px charcoal border. */
export function TextInput({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={cx('input', className)} {...rest} />
}

export function TextArea({ className, ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={cx('input', className)} {...rest} />
}
