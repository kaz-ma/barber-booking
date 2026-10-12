import type { ReactNode } from 'react'

/**
 * RadioGroup: native radios inside 48px label cards (works before hydration). Selection is
 * shown by the dot + 2px border + bold text (charcoal; burgundy is reserved, DG-001 D-03).
 */
export function RadioGroup<V extends string>({
  name,
  value,
  options,
  onChange,
  labelledBy,
  describedBy,
  invalid,
}: {
  name: string
  value: V | ''
  options: { value: V; label: ReactNode }[]
  onChange: (value: V) => void
  labelledBy: string
  describedBy?: string
  invalid?: boolean
}) {
  return (
    <fieldset
      className="radios"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
    >
      {options.map((o) => (
        <label key={o.value} className="radio">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          <span className="rdot" aria-hidden="true" />
          {o.label}
        </label>
      ))}
    </fieldset>
  )
}
