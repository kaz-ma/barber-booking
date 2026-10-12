/** Menu fields the client booking steps need (serializable subset of MenuDTO). */
export type BookingMenu = {
  slug: string
  name: { ja: string; en: string }
  durationMin: number
  priceJpy: number
  priceStudentJpy: number | null
}
