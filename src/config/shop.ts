/**
 * Shop facts shown on the top / done / cancel pages, ICS LOCATION and JSON-LD
 * (OI-09 / OI-10 / OI-23 decided). No phone number by decision (OI-10): customer contact is
 * Instagram DM only. The Instagram account lives here and nowhere else (FR-C-16).
 * TODO(OI-08): English shop / stylist notation.
 */
export const shop = {
  name: 'Neuer Barber',
  stylist: { ja: '長田 健豊', en: 'Kento Osada' },
  address: {
    ja: '大阪市阿倍野区阿倍野筋2-4-48 金村ビル3階南（B）',
    en: '3F South (B), Kanamura Bldg., 2-4-48 Abenosuji, Abeno-ku, Osaka',
  },
  /** Two display lines (access card, done card). */
  addressLines: {
    ja: ['大阪市阿倍野区阿倍野筋2-4-48', '金村ビル3階南（B）'],
    en: ['3F South (B), Kanamura Bldg.', '2-4-48 Abenosuji, Abeno-ku, Osaka'],
  },
  /** schema.org PostalAddress parts (JSON-LD, ja). */
  postalAddress: {
    streetAddress: '阿倍野筋2-4-48 金村ビル3階南（B）',
    addressLocality: '大阪市阿倍野区',
    addressRegion: '大阪府',
    addressCountry: 'JP',
  },
  access: { station: { ja: '天王寺駅', en: 'Tennoji Station' }, walkMinutes: 5 },
  mapUrl:
    'https://maps.google.com/?q=%E5%A4%A7%E9%98%AA%E5%B8%82%E9%98%BF%E5%80%8D%E9%87%8E%E5%8C%BA%E9%98%BF%E5%80%8D%E9%87%8E%E7%AD%8B2-4-48',
  instagram: {
    handle: 'neuer.kento',
    /** Profile: "see our work" (top page). */
    url: 'https://www.instagram.com/neuer.kento/',
    /** Opens the DM thread directly: every "contact us" link (DG-001 §5.7). */
    dmUrl: 'https://ig.me/m/neuer.kento',
  },
  /**
   * Hero photo (U-01). `null` renders the warm CSS placeholder; once the client's photo
   * arrives, put it under public/brand/ and set e.g. { src: '/brand/hero.jpg', width, height }.
   */
  heroPhoto: null as { src: string; width: number; height: number } | null,
  emblem: { src: '/brand/neuer-emblem.png', width: 187, height: 144 },
} as const

/**
 * Version and effective date of the privacy policy / cancellation policy / 特商法 pages
 * (12.1, 12.3). The pages render these values and consents.policy_version stores the string
 * built from them, so a stored consent always points at the text that was shown (SR-13).
 * Bump both when the policy text changes.
 */
export const POLICY = { version: '1.0', effectiveDate: '2026-11-01' } as const

/** Stored in consents.policy_version, e.g. "1.0 (2026-11-01)" (<= 32 chars, CHECK). */
export const POLICY_VERSION = `${POLICY.version} (${POLICY.effectiveDate})`
