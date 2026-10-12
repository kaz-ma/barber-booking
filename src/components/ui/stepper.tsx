import { cx } from './cx'
import { Icon } from './icon'

/**
 * Stepper (DG-001 §5.4): ordered list, done = ring + ✓, current = filled + aria-current="step",
 * upcoming = subtle ring. No accent colour ("where you are", not "selected").
 */
export function Stepper({
  steps,
  current,
  label,
  doneSuffix,
}: {
  steps: readonly string[]
  /** 0-based index of the current step. */
  current: number
  label: string
  /** Visually hidden suffix for completed steps, e.g. "（完了）". */
  doneSuffix: string
}) {
  return (
    <ol className="stepper" aria-label={label}>
      {steps.map((name, i) => {
        const state = i < current ? 'done' : i === current ? 'cur' : undefined
        return (
          <li key={name} className={cx(state)} aria-current={state === 'cur' ? 'step' : undefined}>
            <span className="dot">{state === 'done' ? <Icon name="check" /> : i + 1}</span>
            {name}
            {state === 'done' ? <span className="sr-only">{doneSuffix}</span> : null}
          </li>
        )
      })}
    </ol>
  )
}
