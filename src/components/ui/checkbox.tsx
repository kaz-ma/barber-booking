import type { ComponentProps, ReactNode } from 'react'
import { Icon } from './icon'

/** Checkbox whose whole label is the target (≥ 56px, DG-001 §9.1 ConsentCheckbox). */
export function Checkbox({
  label,
  tag,
  invalid,
  ...input
}: { label: ReactNode; tag?: string; invalid?: boolean } & Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <label className="consent" data-invalid={invalid || undefined}>
      <input type="checkbox" aria-invalid={invalid || undefined} {...input} />
      <span className="cbox" aria-hidden="true">
        <Icon name="check" />
      </span>
      <span>
        {label}
        {tag ? <span className="req">{tag}</span> : null}
      </span>
    </label>
  )
}
