import { useTranslations } from 'next-intl'
import { Stepper } from '@/components/ui/stepper'

const STEPS = ['menu', 'time', 'info', 'confirm'] as const
export type BookingStep = (typeof STEPS)[number]

/** BookingStepper: ① メニュー → ② 日時 → ③ お客様情報 → ④ 確認 (OI-19), aria-current="step". */
export function BookingStepper({ current }: { current: BookingStep }) {
  const t = useTranslations('booking.steps')
  const tNav = useTranslations('nav')
  return (
    <Stepper
      steps={STEPS.map((s) => t(s))}
      current={STEPS.indexOf(current)}
      label={tNav('stepsLabel')}
      doneSuffix={t('doneSr')}
    />
  )
}

/** Polite announcement of the current step ("ステップ 3/4: お客様情報"), 03_screen_specs 共通規約. */
export function StepAnnouncer({ current }: { current: BookingStep }) {
  const t = useTranslations('booking.steps')
  return (
    <p className="sr-only" aria-live="polite">
      {t('live', { n: STEPS.indexOf(current) + 1, name: t(current) })}
    </p>
  )
}
