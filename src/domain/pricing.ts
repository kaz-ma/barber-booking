export type Occupation = 'student' | 'worker'

export type PricedMenu = { priceJpy: number; priceStudentJpy: number | null }

/** Student price when set, otherwise the regular price (FR-C-04, AT-05). */
export function applicablePrice(menu: PricedMenu, occupation: Occupation): number {
  if (occupation === 'student' && menu.priceStudentJpy !== null) return menu.priceStudentJpy
  return menu.priceJpy
}
