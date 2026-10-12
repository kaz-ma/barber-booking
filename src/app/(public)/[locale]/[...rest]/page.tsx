import { notFound } from 'next/navigation'

/** Unknown /{locale}/… paths render the localized 404 (S-C-10) instead of the global one. */
export default function CatchAll() {
  notFound()
}
