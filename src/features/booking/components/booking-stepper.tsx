import { getTranslations } from 'next-intl/server'

const STEPS = ['menu', 'time', 'info', 'confirm'] as const
export type BookingStep = (typeof STEPS)[number]

/** Stepper as an ordered list with aria-current="step" (03_screen_specs.md §1.6). */
export async function BookingStepper({ current }: { current: BookingStep }) {
  const t = await getTranslations('booking.steps')
  return (
    <ol className="mb-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-muted">
      {STEPS.map((step) => (
        <li
          key={step}
          aria-current={step === current ? 'step' : undefined}
          className={step === current ? 'font-bold text-fg' : undefined}
        >
          {t(step)}
        </li>
      ))}
    </ol>
  )
}
