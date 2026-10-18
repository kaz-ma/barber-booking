/** A5: barber-pole stripe shown while something loads (globals.css `.pole`). Decorative. */
export function BarberPole({ className = '' }: { className?: string }) {
  return <span className={`pole ${className}`} aria-hidden="true" />
}
