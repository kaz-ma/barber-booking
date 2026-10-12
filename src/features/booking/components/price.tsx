import { formatYen } from '@/lib/i18n/display'

/**
 * Price figure with a small "¥" (DG-001 §3 big Lato numbers). A price of 0 means "not set yet"
 * (OI-01) and renders "¥—" with a spoken label instead of "¥0".
 */
export function Yen({ amount, unsetSr }: { amount: number | null; unsetSr: string }) {
  if (!amount) {
    return (
      <>
        <small>¥</small>—<span className="sr-only">{unsetSr}</span>
      </>
    )
  }
  return (
    <>
      <small>¥</small>
      {formatYen(amount).slice(1)}
    </>
  )
}

export function yenText(amount: number | null): string {
  return amount ? formatYen(amount) : '¥—'
}
